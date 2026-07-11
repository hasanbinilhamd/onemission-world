import { prisma } from '@/lib/prisma';
import { cashFlowService, inventoryValuationService } from '@/lib/finance-reporting';

const ORDER_EXCLUDED_STATUSES = ['CANCELLED', 'REFUNDED'];
const DEFAULT_TOP_LIMIT = 10;
const DEFAULT_RECENT_LIMIT = 8;

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function startOfWeek(date) {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(value, diff);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatDateOnly(date) {
  return new Date(date).toISOString().split('T')[0];
}

function formatMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function resolvePeriod({ range = 'thisMonth', from = '', to = '', now = new Date() } = {}) {
  const today = endOfDay(now);

  if (range === 'custom' && from && to) {
    const fromDate = startOfDay(new Date(from));
    const toDate = endOfDay(new Date(to));
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime()) && fromDate <= toDate) {
      return {
        range: 'custom',
        fromDate,
        toDate,
        from: formatDateOnly(fromDate),
        to: formatDateOnly(toDate),
        label: `${formatDateOnly(fromDate)} → ${formatDateOnly(toDate)}`,
      };
    }
  }

  if (range === 'today') {
    const fromDate = startOfDay(now);
    return {
      range: 'today',
      fromDate,
      toDate: today,
      from: formatDateOnly(fromDate),
      to: formatDateOnly(today),
      label: 'Today',
    };
  }

  if (range === 'thisWeek') {
    const fromDate = startOfWeek(now);
    return {
      range: 'thisWeek',
      fromDate,
      toDate: today,
      from: formatDateOnly(fromDate),
      to: formatDateOnly(today),
      label: 'This Week',
    };
  }

  if (range === 'lastMonth') {
    const lastMonthDate = addMonths(now, -1);
    const fromDate = startOfMonth(lastMonthDate);
    const toDate = endOfMonth(lastMonthDate);
    return {
      range: 'lastMonth',
      fromDate,
      toDate,
      from: formatDateOnly(fromDate),
      to: formatDateOnly(toDate),
      label: 'Last Month',
    };
  }

  if (range === 'thisYear') {
    const fromDate = startOfDay(new Date(now.getFullYear(), 0, 1));
    return {
      range: 'thisYear',
      fromDate,
      toDate: today,
      from: formatDateOnly(fromDate),
      to: formatDateOnly(today),
      label: `This Year ${now.getFullYear()}`,
    };
  }

  const fromDate = startOfMonth(now);
  return {
    range: 'thisMonth',
    fromDate,
    toDate: today,
    from: formatDateOnly(fromDate),
    to: formatDateOnly(today),
    label: 'This Month',
  };
}

function buildPaidOrderWhere(fromDate, toDate) {
  return {
    createdAt: {
      gte: fromDate,
      lte: toDate,
    },
    status: {
      notIn: ORDER_EXCLUDED_STATUSES,
    },
    paymentAttempt: {
      is: {
        status: 'PAID',
      },
    },
  };
}

function buildFilledMonthlySeries(fromDate, toDate, seedFactory) {
  const buckets = [];
  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);

  while (cursor <= end) {
    buckets.push(seedFactory(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
}

function aggregateOrdersByProduct(orders = []) {
  const map = new Map();

  for (const order of orders) {
    for (const item of order.items || []) {
      const key = item.productId || `${item.sku}-${item.productName}`;
      if (!map.has(key)) {
        map.set(key, {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          unitsSold: 0,
          revenue: 0,
          category: item.productCategory || 'Uncategorized',
        });
      }

      const current = map.get(key);
      current.unitsSold += Number(item.quantity || 0);
      current.revenue += Number(item.subtotal || 0);
    }
  }

  return [...map.values()];
}

function absoluteMovementQuantity(movement) {
  const delta = Number(movement.newQuantity || 0) - Number(movement.previousQuantity || 0);
  if (delta !== 0) {
    return Math.abs(delta);
  }
  return Math.abs(Number(movement.quantityChanged || movement.quantity || 0));
}

function sum(values = []) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function calculateGrowth(currentValue, previousValue) {
  if (!Number.isFinite(previousValue) || previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

export class ReportsService {
  constructor({
    prismaClient = prisma,
    cashFlow = cashFlowService,
    inventoryValuation = inventoryValuationService,
    nowFactory = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.cashFlowService = cashFlow;
    this.inventoryValuationService = inventoryValuation;
    this.nowFactory = nowFactory;
  }

  resolvePeriod(filters = {}) {
    return resolvePeriod({ ...filters, now: this.nowFactory() });
  }

  async getProductAnalytics(filters = {}) {
    const period = this.resolvePeriod(filters);

    const [products, orders, inventoryRows] = await Promise.all([
      this.prisma.product.findMany({
        orderBy: { name: 'asc' },
      }),
      this.prisma.order.findMany({
        where: buildPaidOrderWhere(period.fromDate, period.toDate),
        select: {
          id: true,
          items: {
            select: {
              productId: true,
              productName: true,
              sku: true,
              quantity: true,
              subtotal: true,
            },
          },
        },
      }),
      this.prisma.inventory.findMany({
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: true,
            },
          },
        },
      }),
    ]);

    const productSales = aggregateOrdersByProduct(
      orders.map((order) => ({
        ...order,
        items: (order.items || []).map((item) => ({
          ...item,
          productCategory: products.find((product) => product.id === item.productId)?.category || 'Uncategorized',
        })),
      })),
    );

    const inventoryByProduct = new Map();
    let lowStockProducts = 0;
    for (const inventory of inventoryRows) {
      const current = inventoryByProduct.get(inventory.productId) || { currentStock: 0, lowStock: false };
      current.currentStock += Number(inventory.quantity || 0);
      if (Number(inventory.quantity || 0) <= Number(inventory.threshold || 0)) {
        current.lowStock = true;
      }
      inventoryByProduct.set(inventory.productId, current);
    }
    lowStockProducts = [...inventoryByProduct.values()].filter((entry) => entry.lowStock).length;

    const salesByProduct = products.map((product) => {
      const sales = productSales.find((entry) => entry.productId === product.id) || null;
      const inventory = inventoryByProduct.get(product.id) || { currentStock: 0, lowStock: false };
      return {
        id: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category,
        status: product.status,
        unitsSold: Number(sales?.unitsSold || 0),
        revenue: Number(sales?.revenue || 0),
        currentStock: Number(inventory.currentStock || 0),
        isLowStock: inventory.lowStock,
      };
    });

    const bestSellingProducts = [...salesByProduct]
      .sort((left, right) => right.unitsSold - left.unitsSold || right.revenue - left.revenue)
      .slice(0, DEFAULT_TOP_LIMIT);

    const lowestSellingProducts = [...salesByProduct]
      .sort((left, right) => left.unitsSold - right.unitsSold || left.revenue - right.revenue)
      .slice(0, DEFAULT_TOP_LIMIT);

    const salesByCategoryMap = new Map();
    for (const product of salesByProduct) {
      const key = product.category || 'Uncategorized';
      const current = salesByCategoryMap.get(key) || { name: key, revenue: 0, unitsSold: 0 };
      current.revenue += product.revenue;
      current.unitsSold += product.unitsSold;
      salesByCategoryMap.set(key, current);
    }

    return {
      period,
      metrics: {
        totalProducts: products.length,
        activeProducts: products.filter((product) => product.status === 'Active').length,
        archivedProducts: products.filter((product) => product.status === 'Archived').length,
        totalUnitsSold: sum(salesByProduct.map((product) => product.unitsSold)),
        currentInventory: sum(salesByProduct.map((product) => product.currentStock)),
        lowStockProducts,
      },
      charts: {
        topSellingProducts: bestSellingProducts.slice(0, DEFAULT_TOP_LIMIT),
        revenueByProduct: [...salesByProduct]
          .sort((left, right) => right.revenue - left.revenue)
          .slice(0, DEFAULT_TOP_LIMIT),
        salesByCategory: [...salesByCategoryMap.values()].sort((left, right) => right.revenue - left.revenue),
      },
      tables: {
        products: salesByProduct,
        bestSellingProducts,
        lowestSellingProducts,
      },
    };
  }

  async getInventoryAnalytics(filters = {}) {
    const period = this.resolvePeriod(filters);

    const adjustmentTypes = [
      'MANUAL_ADJUSTMENT',
      'MANUAL_IN',
      'MANUAL_OUT',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
      'INITIAL_STOCK',
      'OPENING',
      'STOCK_OPNAME',
    ];

    const [valuation, inventoryRows, movementRows] = await Promise.all([
      this.inventoryValuationService.buildReport(),
      this.prisma.inventory.findMany({
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: true,
            },
          },
        },
      }),
      this.prisma.stockMovement.findMany({
        where: {
          itemType: 'PRODUCT',
          movementDate: {
            gte: period.from,
            lte: period.to,
          },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
        orderBy: [{ movementDate: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const lowStockList = inventoryRows
      .filter((row) => Number(row.quantity || 0) <= Number(row.threshold || 0))
      .map((row) => ({
        id: row.id,
        productName: row.product?.name || 'Unknown Product',
        sku: row.product?.sku || '',
        variant: `${row.color} / ${row.size}`,
        quantity: Number(row.quantity || 0),
        threshold: Number(row.threshold || 0),
      }))
      .sort((left, right) => left.quantity - right.quantity);

    const movementByProduct = new Map();
    for (const movement of movementRows) {
      const key = movement.productId || movement.product?.id;
      if (!key) continue;
      if (!movementByProduct.has(key)) {
        movementByProduct.set(key, {
          productId: key,
          productName: movement.product?.name || 'Unknown Product',
          sku: movement.product?.sku || '',
          movementQuantity: 0,
          movementCount: 0,
        });
      }
      const current = movementByProduct.get(key);
      current.movementQuantity += absoluteMovementQuantity(movement);
      current.movementCount += 1;
    }

    const movementTrendMap = new Map();
    for (const movement of movementRows) {
      const key = movement.movementDate;
      if (!movementTrendMap.has(key)) {
        movementTrendMap.set(key, { date: key, inbound: 0, outbound: 0 });
      }
      const current = movementTrendMap.get(key);
      const delta = Number(movement.newQuantity || 0) - Number(movement.previousQuantity || 0);
      if (delta >= 0) {
        current.inbound += Math.abs(delta || absoluteMovementQuantity(movement));
      } else {
        current.outbound += Math.abs(delta);
      }
    }

    const stockDistribution = [
      {
        name: 'Healthy',
        value: inventoryRows.filter((row) => Number(row.quantity || 0) > Number(row.threshold || 0)).length,
      },
      {
        name: 'Low Stock',
        value: inventoryRows.filter((row) => Number(row.quantity || 0) > 0 && Number(row.quantity || 0) <= Number(row.threshold || 0)).length,
      },
      {
        name: 'Out of Stock',
        value: inventoryRows.filter((row) => Number(row.quantity || 0) <= 0).length,
      },
    ];

    const recentInventoryAdjustments = movementRows
      .filter((movement) => adjustmentTypes.includes(movement.movementType))
      .slice(0, DEFAULT_RECENT_LIMIT)
      .map((movement) => ({
        id: movement.id,
        movementDate: movement.movementDate,
        movementType: movement.movementType,
        productName: movement.product?.name || 'Unknown Product',
        sku: movement.product?.sku || '',
        quantityChanged: absoluteMovementQuantity(movement),
        notes: movement.notes || '',
      }));

    const movementProducts = [...movementByProduct.values()]
      .sort((left, right) => right.movementQuantity - left.movementQuantity || right.movementCount - left.movementCount);

    return {
      period,
      metrics: {
        totalInventoryValue: Number(valuation.totalInventoryValue || 0),
        inventoryQuantity: sum(inventoryRows.map((row) => row.quantity)),
        lowStockCount: lowStockList.length,
        outOfStockCount: inventoryRows.filter((row) => Number(row.quantity || 0) <= 0).length,
        averageStock: inventoryRows.length > 0 ? sum(inventoryRows.map((row) => row.quantity)) / inventoryRows.length : 0,
      },
      charts: {
        inventoryValueByProduct: valuation.rows.slice(0, DEFAULT_TOP_LIMIT),
        stockDistribution,
        movementTrend: [...movementTrendMap.values()].sort((left, right) => left.date.localeCompare(right.date)),
      },
      tables: {
        mostMovedProducts: movementProducts.slice(0, DEFAULT_TOP_LIMIT),
        leastMovedProducts: [...movementProducts].reverse().slice(0, DEFAULT_TOP_LIMIT),
        recentInventoryAdjustments,
        lowStockList,
      },
    };
  }

  async getFinancialAnalytics(filters = {}) {
    const period = this.resolvePeriod(filters);

    const [orders, cogsJournals, cashOutTransactions, recentCashIn, recentCashOut, cashFlowClosing] = await Promise.all([
      this.prisma.order.findMany({
        where: buildPaidOrderWhere(period.fromDate, period.toDate),
        select: {
          createdAt: true,
          grandTotal: true,
        },
      }),
      this.prisma.journalEntry.findMany({
        where: {
          journalSource: 'COGS',
          journalType: 'System',
          status: 'Posted',
          journalDate: {
            gte: period.from,
            lte: period.to,
          },
        },
        select: {
          journalDate: true,
          totalDebit: true,
        },
      }),
      this.prisma.cashTransaction.findMany({
        where: {
          transactionType: 'OUT',
          transactionDate: {
            gte: period.from,
            lte: period.to,
          },
        },
        include: {
          expenseCategory: true,
          financialAccount: {
            select: { name: true },
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.cashTransaction.findMany({
        where: { transactionType: 'IN' },
        include: {
          financialAccount: {
            select: { name: true },
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        take: DEFAULT_RECENT_LIMIT,
      }),
      this.prisma.cashTransaction.findMany({
        where: { transactionType: 'OUT' },
        include: {
          financialAccount: {
            select: { name: true },
          },
          expenseCategory: true,
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        take: DEFAULT_RECENT_LIMIT,
      }),
      this.cashFlowService.buildReport({ to: period.to }),
    ]);

    const revenue = sum(orders.map((order) => order.grandTotal));
    const expenses = sum(cashOutTransactions.map((transaction) => transaction.amount));
    const cogs = sum(cogsJournals.map((journal) => journal.totalDebit));
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;

    const revenueByMonth = new Map();
    for (const order of orders) {
      const key = formatMonthKey(new Date(order.createdAt));
      revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + Number(order.grandTotal || 0));
    }
    const cogsByMonth = new Map();
    for (const journal of cogsJournals) {
      const key = String(journal.journalDate || '').slice(0, 7);
      cogsByMonth.set(key, (cogsByMonth.get(key) || 0) + Number(journal.totalDebit || 0));
    }
    const expenseByMonth = new Map();
    for (const transaction of cashOutTransactions) {
      const key = String(transaction.transactionDate || '').slice(0, 7);
      expenseByMonth.set(key, (expenseByMonth.get(key) || 0) + Number(transaction.amount || 0));
    }

    const monthlyBase = buildFilledMonthlySeries(period.fromDate, period.toDate, (date) => ({
      key: formatMonthKey(date),
      month: formatMonthLabel(date),
      revenue: 0,
      expenses: 0,
      cogs: 0,
      netProfit: 0,
      cashFlow: 0,
    }));

    const journalCashEntries = await this.prisma.journalEntry.findMany({
      where: {
        status: 'Posted',
        journalDate: {
          gte: period.from,
          lte: period.to,
        },
        journalSource: {
          in: ['Sales', 'Cash In', 'Cash Out'],
        },
      },
      select: {
        journalDate: true,
        journalSource: true,
        totalDebit: true,
      },
    });
    const cashFlowByMonth = new Map();
    for (const entry of journalCashEntries) {
      const key = String(entry.journalDate || '').slice(0, 7);
      const direction = entry.journalSource === 'Cash Out' ? -1 : 1;
      cashFlowByMonth.set(key, (cashFlowByMonth.get(key) || 0) + (Number(entry.totalDebit || 0) * direction));
    }

    const monthlySeries = monthlyBase.map((bucket) => {
      const monthRevenue = Number(revenueByMonth.get(bucket.key) || 0);
      const monthCogs = Number(cogsByMonth.get(bucket.key) || 0);
      const monthExpenses = Number(expenseByMonth.get(bucket.key) || 0);
      return {
        ...bucket,
        revenue: monthRevenue,
        expenses: monthExpenses,
        cogs: monthCogs,
        netProfit: monthRevenue - monthCogs - monthExpenses,
        cashFlow: Number(cashFlowByMonth.get(bucket.key) || 0),
      };
    });

    const expenseCategoryBreakdown = new Map();
    for (const transaction of cashOutTransactions) {
      const category = String(transaction.expenseCategoryName || transaction.expenseCategory?.name || 'Uncategorized').trim() || 'Uncategorized';
      expenseCategoryBreakdown.set(category, (expenseCategoryBreakdown.get(category) || 0) + Number(transaction.amount || 0));
    }

    return {
      period,
      metrics: {
        revenue,
        expenses,
        netProfit,
        cashPosition: Number(cashFlowClosing.closingCashPosition || 0),
        cogs,
        grossProfit,
      },
      charts: {
        revenueVsExpense: monthlySeries,
        cashFlowTrend: monthlySeries,
        monthlyProfit: monthlySeries,
        expenseCategoryBreakdown: [...expenseCategoryBreakdown.entries()].map(([name, value]) => ({ name, value })),
      },
      tables: {
        topExpenseCategories: [...expenseCategoryBreakdown.entries()]
          .map(([name, value]) => ({ name, value }))
          .sort((left, right) => right.value - left.value)
          .slice(0, DEFAULT_TOP_LIMIT),
        recentCashIn: recentCashIn.map((transaction) => ({
          id: transaction.id,
          date: transaction.transactionDate,
          amount: Number(transaction.amount || 0),
          financialAccountName: transaction.financialAccount?.name || '—',
          description: transaction.description || '',
          referenceNumber: transaction.referenceNumber || '',
        })),
        recentCashOut: recentCashOut.map((transaction) => ({
          id: transaction.id,
          date: transaction.transactionDate,
          amount: Number(transaction.amount || 0),
          financialAccountName: transaction.financialAccount?.name || '—',
          description: transaction.description || '',
          referenceNumber: transaction.referenceNumber || '',
          expenseCategoryName: String(transaction.expenseCategoryName || transaction.expenseCategory?.name || 'Uncategorized').trim() || 'Uncategorized',
        })),
      },
    };
  }

  async getMarketingAnalytics(filters = {}) {
    const period = this.resolvePeriod(filters);

    const [orders, newestCustomers] = await Promise.all([
      this.prisma.order.findMany({
        where: buildPaidOrderWhere(period.fromDate, period.toDate),
        select: {
          id: true,
          customerId: true,
          customerName: true,
          salesChannelId: true,
          salesChannelName: true,
          grandTotal: true,
          createdAt: true,
        },
      }),
      this.prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        take: DEFAULT_TOP_LIMIT,
        select: {
          id: true,
          customerCode: true,
          customerName: true,
          email: true,
          phone: true,
          createdAt: true,
        },
      }),
    ]);

    const uniqueCustomers = new Set();
    const ordersByCustomer = new Map();
    const channelMap = new Map();
    const ordersByDayMap = new Map();

    for (const order of orders) {
      uniqueCustomers.add(order.customerId);
      ordersByCustomer.set(order.customerId, (ordersByCustomer.get(order.customerId) || 0) + 1);

      const channelKey = order.salesChannelId || order.salesChannelName || 'unknown';
      if (!channelMap.has(channelKey)) {
        channelMap.set(channelKey, {
          channelId: order.salesChannelId,
          channelName: order.salesChannelName || 'Unknown Channel',
          orders: 0,
          revenue: 0,
        });
      }
      const channel = channelMap.get(channelKey);
      channel.orders += 1;
      channel.revenue += Number(order.grandTotal || 0);

      const dayKey = formatDateOnly(order.createdAt);
      ordersByDayMap.set(dayKey, (ordersByDayMap.get(dayKey) || 0) + 1);
    }

    const topCustomers = [...orders.reduce((map, order) => {
      const key = order.customerId || order.customerName;
      if (!map.has(key)) {
        map.set(key, {
          customerId: order.customerId,
          customerName: order.customerName,
          orderCount: 0,
          revenue: 0,
        });
      }
      const customer = map.get(key);
      customer.orderCount += 1;
      customer.revenue += Number(order.grandTotal || 0);
      return map;
    }, new Map()).values()]
      .sort((left, right) => right.revenue - left.revenue || right.orderCount - left.orderCount)
      .slice(0, DEFAULT_TOP_LIMIT);

    const channelRows = [...channelMap.values()].sort((left, right) => right.revenue - left.revenue || right.orders - left.orders);

    return {
      period,
      metrics: {
        orders: orders.length,
        revenue: sum(orders.map((order) => order.grandTotal)),
        averageOrderValue: orders.length > 0 ? sum(orders.map((order) => order.grandTotal)) / orders.length : 0,
        customers: uniqueCustomers.size,
        repeatCustomers: [...ordersByCustomer.values()].filter((count) => count > 1).length,
      },
      charts: {
        salesByChannel: channelRows,
        revenueByChannel: channelRows,
        ordersByDay: [...ordersByDayMap.entries()]
          .map(([date, total]) => ({ date, total }))
          .sort((left, right) => left.date.localeCompare(right.date)),
      },
      tables: {
        topCustomers,
        topSalesChannels: channelRows.slice(0, DEFAULT_TOP_LIMIT),
        newestCustomers,
      },
    };
  }

  async getExecutiveReport(filters = {}) {
    const period = this.resolvePeriod(filters);
    const paidOrderWhere = buildPaidOrderWhere(period.fromDate, period.toDate);

    const [
      financialAnalytics,
      marketingAnalytics,
      inventoryAnalytics,
      productionResults,
      latestExpenses,
      latestCashIn,
      latestOrders,
      pendingOrders,
      draftJournals,
      recentFailedProduction,
      cashFlowReport,
    ] = await Promise.all([
      this.getFinancialAnalytics(filters),
      this.getMarketingAnalytics(filters),
      this.getInventoryAnalytics(filters),
      this.prisma.productionResult.findMany({
        where: {
          productionOrder: {
            completedAt: {
              gte: period.fromDate,
              lte: period.toDate,
            },
          },
        },
        include: {
          productionOrder: {
            include: {
              product: {
                select: {
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: DEFAULT_RECENT_LIMIT,
      }),
      this.prisma.cashTransaction.findMany({
        where: {
          transactionType: 'OUT',
          transactionDate: {
            gte: period.from,
            lte: period.to,
          },
        },
        include: {
          expenseCategory: true,
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        take: DEFAULT_RECENT_LIMIT,
      }),
      this.prisma.cashTransaction.findMany({
        where: {
          transactionType: 'IN',
          transactionDate: {
            gte: period.from,
            lte: period.to,
          },
        },
        include: {
          financialAccount: {
            select: { name: true },
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        take: DEFAULT_RECENT_LIMIT,
      }),
      this.prisma.order.findMany({
        where: paidOrderWhere,
        orderBy: { createdAt: 'desc' },
        take: DEFAULT_RECENT_LIMIT,
        select: {
          id: true,
          orderNumber: true,
          publicOrderNumber: true,
          customerName: true,
          grandTotal: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.order.count({
        where: {
          status: { in: ['READY_FOR_FULFILLMENT', 'PROCESSING', 'SHIPPED'] },
        },
      }),
      this.prisma.journalEntry.count({
        where: {
          status: { not: 'Posted' },
        },
      }),
      this.prisma.productionOrder.findMany({
        where: {
          status: 'Cancelled',
          updatedAt: {
            gte: period.fromDate,
            lte: period.toDate,
          },
        },
        include: {
          product: {
            select: { name: true, sku: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: DEFAULT_RECENT_LIMIT,
      }),
      this.cashFlowService.buildReport({ to: period.to }),
    ]);

    const lowStockAlerts = inventoryAnalytics.tables.lowStockList.slice(0, DEFAULT_RECENT_LIMIT);
    const negativeCashAccounts = (cashFlowReport.accountSummary || []).filter((account) => Number(account.closingBalance || 0) < 0);

    return {
      period,
      cards: {
        revenue: financialAnalytics.metrics.revenue,
        profit: financialAnalytics.metrics.netProfit,
        cash: financialAnalytics.metrics.cashPosition,
        orders: marketingAnalytics.metrics.orders,
        customers: marketingAnalytics.metrics.customers,
        inventoryValue: inventoryAnalytics.metrics.totalInventoryValue,
        productionCost: sum(productionResults.map((result) => result.totalProductionCost)),
        lowStock: inventoryAnalytics.metrics.lowStockCount,
      },
      recentActivities: {
        latestOrders: latestOrders.map((order) => ({
          id: order.id,
          orderNumber: order.publicOrderNumber || order.orderNumber,
          customerName: order.customerName,
          amount: Number(order.grandTotal || 0),
          status: order.status,
          createdAt: order.createdAt,
        })),
        latestExpenses: latestExpenses.map((transaction) => ({
          id: transaction.id,
          date: transaction.transactionDate,
          amount: Number(transaction.amount || 0),
          category: String(transaction.expenseCategoryName || transaction.expenseCategory?.name || 'Uncategorized').trim() || 'Uncategorized',
          description: transaction.description || '',
        })),
        latestCashIn: latestCashIn.map((transaction) => ({
          id: transaction.id,
          date: transaction.transactionDate,
          amount: Number(transaction.amount || 0),
          financialAccountName: transaction.financialAccount?.name || '—',
          description: transaction.description || '',
        })),
        latestProduction: productionResults.map((result) => ({
          id: result.id,
          resultNumber: result.resultNumber,
          productName: result.productionOrder?.product?.name || 'Unknown Product',
          quantity: Number(result.productionOrder?.actualQuantity || 0),
          totalProductionCost: Number(result.totalProductionCost || 0),
          createdAt: result.createdAt,
        })),
      },
      alerts: {
        lowStock: lowStockAlerts,
        negativeCash: negativeCashAccounts,
        unpostedJournalCount: draftJournals,
        pendingOrders,
        recentFailedProduction: recentFailedProduction.map((order) => ({
          id: order.id,
          productionOrderNumber: order.productionOrderNumber,
          productName: order.product?.name || 'Unknown Product',
          updatedAt: order.updatedAt,
        })),
      },
    };
  }
}

export const reportsService = new ReportsService();
