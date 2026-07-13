import { prisma } from '@/lib/prisma';
import { buildContentScriptSummary } from '@/lib/content-script/service';
import { cashFlowService, inventoryValuationService } from '@/lib/finance-reporting';

const ORDER_EXCLUDED_STATUSES = ['CANCELLED', 'REFUNDED'];
const DEFAULT_LATEST_ORDERS_LIMIT = 8;
const DEFAULT_TOP_PRODUCTS_LIMIT = 10;
const DEFAULT_RECENT_CASH_LIMIT = 8;
const DEFAULT_LOW_STOCK_LIMIT = 8;

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

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function formatDateOnly(date) {
  return new Date(date).toISOString().split('T')[0];
}

function formatMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthLabel(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function resolvePeriod({ range = 'last30', from = '', to = '', now = new Date() } = {}) {
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

  const fromDate = startOfDay(addDays(today, -29));
  return {
    range: 'last30',
    fromDate,
    toDate: today,
    from: formatDateOnly(fromDate),
    to: formatDateOnly(today),
    label: 'Last 30 Days',
  };
}

function buildOrderWhere(fromDate, toDate) {
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

function buildMonthlySeries(orders = []) {
  const buckets = new Map();

  for (const order of orders) {
    const createdAt = new Date(order.createdAt);
    if (Number.isNaN(createdAt.getTime())) continue;
    const key = formatMonthKey(createdAt);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        month: formatMonthLabel(createdAt),
        revenue: 0,
      });
    }
    buckets.get(key).revenue += Number(order.grandTotal || 0);
  }

  return [...buckets.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function groupExpenseBreakdown(transactions = []) {
  const totals = new Map();

  for (const transaction of transactions) {
    const categoryName = String(
      transaction.expenseCategoryName
      || transaction.expenseCategory?.name
      || 'Uncategorized',
    ).trim() || 'Uncategorized';
    totals.set(categoryName, (totals.get(categoryName) || 0) + Number(transaction.amount || 0));
  }

  return [...totals.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value);
}

function buildTopSellingProducts(orders = [], limit = DEFAULT_TOP_PRODUCTS_LIMIT) {
  const aggregates = new Map();

  for (const order of orders) {
    for (const item of order.items || []) {
      const key = item.productId || item.sku || item.productName;
      if (!aggregates.has(key)) {
        aggregates.set(key, {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          qtySold: 0,
          revenue: 0,
        });
      }

      const current = aggregates.get(key);
      current.qtySold += Number(item.quantity || 0);
      current.revenue += Number(item.subtotal || 0);
    }
  }

  return [...aggregates.values()]
    .sort((left, right) => {
      if (right.qtySold !== left.qtySold) {
        return right.qtySold - left.qtySold;
      }
      return right.revenue - left.revenue;
    })
    .slice(0, limit);
}

function buildLatestOrders(orders = []) {
  return orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    publicOrderNumber: order.publicOrderNumber,
    customerName: order.customerName,
    amount: Number(order.grandTotal || 0),
    status: order.status,
    paymentStatus: order.paymentAttempt?.status || 'UNKNOWN',
    createdAt: order.createdAt,
  }));
}

function buildRecentCashActivities(transactions = []) {
  return transactions.map((transaction) => ({
    id: transaction.id,
    transactionDate: transaction.transactionDate,
    type: transaction.transactionType === 'IN' ? 'Cash In' : 'Cash Out',
    amount: Number(transaction.amount || 0),
    financialAccountName: transaction.financialAccount?.name || '—',
    referenceNumber: transaction.referenceNumber || '',
    description: transaction.description || '',
    createdAt: transaction.createdAt,
  }));
}

function buildLowStockRows(inventoryRows = [], limit = DEFAULT_LOW_STOCK_LIMIT) {
  return inventoryRows
    .filter((row) => Number(row.quantity || 0) <= Number(row.threshold || 0))
    .sort((left, right) => {
      const leftGap = Number(left.quantity || 0) - Number(left.threshold || 0);
      const rightGap = Number(right.quantity || 0) - Number(right.threshold || 0);
      return leftGap - rightGap;
    })
    .slice(0, limit)
    .map((row) => ({
      id: row.id,
      productId: row.productId,
      productName: row.product?.name || 'Unknown Product',
      sku: row.product?.sku || '',
      variant: `${row.color} / ${row.size}`,
      quantity: Number(row.quantity || 0),
      threshold: Number(row.threshold || 0),
      status: Number(row.quantity || 0) <= 0 ? 'Out of Stock' : 'Low Stock',
    }));
}

function calculateGrowth(currentValue, previousValue) {
  if (!Number.isFinite(previousValue) || previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
}

export class DashboardService {
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

  async getExecutiveDashboardSummary({ range = 'last30', from = '', to = '' } = {}) {
    const now = this.nowFactory();
    const period = resolvePeriod({ range, from, to, now });
    const currentMonthFrom = startOfMonth(now);
    const currentMonthTo = endOfMonth(now);
    const previousMonthDate = addMonths(now, -1);
    const previousMonthFrom = startOfMonth(previousMonthDate);
    const previousMonthTo = endOfMonth(previousMonthDate);
    const todayString = formatDateOnly(now);

    const [
      periodOrdersAggregate,
      currentMonthOrders,
      previousMonthOrders,
      cogsAggregate,
      cashOutAggregate,
      lowStockCount,
      cashPositionReport,
      inventoryValuation,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: buildOrderWhere(period.fromDate, period.toDate),
        _sum: { grandTotal: true },
      }),
      this.prisma.order.aggregate({
        where: buildOrderWhere(currentMonthFrom, currentMonthTo),
        _sum: { grandTotal: true },
      }),
      this.prisma.order.aggregate({
        where: buildOrderWhere(previousMonthFrom, previousMonthTo),
        _sum: { grandTotal: true },
      }),
      this.prisma.journalEntry.aggregate({
        where: {
          journalSource: 'COGS',
          journalType: 'System',
          status: 'Posted',
          journalDate: { gte: period.from, lte: period.to },
        },
        _sum: { totalDebit: true },
      }),
      this.prisma.cashTransaction.aggregate({
        where: {
          transactionType: 'OUT',
          transactionDate: { gte: period.from, lte: period.to },
        },
        _sum: { amount: true },
      }),
      this.prisma.inventory.findMany({
        select: { quantity: true, threshold: true },
      }).then((rows) => rows.filter((row) => Number(row.quantity || 0) <= Number(row.threshold || 0)).length),
      this.cashFlowService.buildReport({ to: todayString }),
      this.inventoryValuationService.buildReport(),
    ]);

    const totalRevenue = Number(periodOrdersAggregate._sum?.grandTotal || 0);
    const monthlyRevenue = Number(currentMonthOrders._sum?.grandTotal || 0);
    const previousMonthRevenue = Number(previousMonthOrders._sum?.grandTotal || 0);
    const revenueGrowth = calculateGrowth(monthlyRevenue, previousMonthRevenue);
    const totalCogs = Number(cogsAggregate._sum?.totalDebit || 0);
    const totalExpenses = Number(cashOutAggregate._sum?.amount || 0);

    return {
      period: {
        range: period.range,
        from: period.from,
        to: period.to,
        label: period.label,
      },
      kpis: {
        totalRevenue,
        monthlyRevenue,
        monthlyRevenueGrowth: Number(revenueGrowth.toFixed(1)),
        netProfit: totalRevenue - totalCogs - totalExpenses,
        expenses: totalExpenses,
        cashPosition: Number(cashPositionReport?.closingCashPosition || 0),
        lowStockCount: Number(lowStockCount || 0),
        currentInventoryValue: Number(inventoryValuation.totalInventoryValue || 0),
        cogsThisMonth: totalCogs,
        grossProfit: totalRevenue - totalCogs,
      },
    };
  }

  async getExecutiveDashboardDetails({ range = 'last30', from = '', to = '' } = {}) {
    const now = this.nowFactory();
    const period = resolvePeriod({ range, from, to, now });
    const orderWhere = buildOrderWhere(period.fromDate, period.toDate);
    const currentMonthFrom = startOfMonth(now);
    const currentMonthTo = endOfMonth(now);
    const todayString = formatDateOnly(now);

    const [
      periodOrders,
      latestOrders,
      cashOutTransactions,
      inventoryRows,
      recentCashTransactions,
      productionOrderCountThisMonth,
      completedProductionResultsThisMonth,
      contentPlannerThisMonth,
      cashPositionReport,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          orderNumber: true,
          publicOrderNumber: true,
          customerName: true,
          grandTotal: true,
          status: true,
          createdAt: true,
          paymentAttempt: { select: { status: true } },
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
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.order.findMany({
        where: {
          status: { notIn: ORDER_EXCLUDED_STATUSES },
          paymentAttempt: { is: { status: 'PAID' } },
        },
        select: {
          id: true,
          orderNumber: true,
          publicOrderNumber: true,
          customerName: true,
          grandTotal: true,
          status: true,
          createdAt: true,
          paymentAttempt: { select: { status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: DEFAULT_LATEST_ORDERS_LIMIT,
      }),
      this.prisma.cashTransaction.findMany({
        where: {
          transactionType: 'OUT',
          transactionDate: { gte: period.from, lte: period.to },
        },
        include: { expenseCategory: true },
      }),
      this.prisma.inventory.findMany({
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      }),
      this.prisma.cashTransaction.findMany({
        include: { financialAccount: { select: { name: true } } },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        take: DEFAULT_RECENT_CASH_LIMIT,
      }),
      this.prisma.productionOrder.count({
        where: { createdAt: { gte: currentMonthFrom, lte: currentMonthTo } },
      }),
      this.prisma.productionResult.findMany({
        where: { productionOrder: { completedAt: { gte: currentMonthFrom, lte: currentMonthTo } } },
        include: { productionOrder: { select: { actualQuantity: true } } },
      }),
      this.prisma.contentPlanner.findMany({
        where: {
          calendarDate: { startsWith: formatMonthKey(currentMonthFrom) },
        },
        select: {
          id: true,
          title: true,
          category: true,
          calendarDate: true,
          pdfFilename: true,
        },
        orderBy: [
          { calendarDate: 'asc' },
          { title: 'asc' },
        ],
      }),
      this.cashFlowService.buildReport({ to: todayString }),
    ]);

    const lowStockRows = buildLowStockRows(inventoryRows);
    const completedProduction = completedProductionResultsThisMonth.length;
    const totalProductionCost = completedProductionResultsThisMonth.reduce((sum, result) => sum + Number(result.totalProductionCost || 0), 0);
    const finishedGoodsProduced = completedProductionResultsThisMonth.reduce((sum, result) => sum + Number(result.productionOrder?.actualQuantity || 0), 0);
    const contentPlannerSummary = buildContentScriptSummary(contentPlannerThisMonth, now);

    return {
      revenueByMonth: buildMonthlySeries(periodOrders),
      expenseBreakdown: groupExpenseBreakdown(cashOutTransactions),
      topSellingProducts: buildTopSellingProducts(periodOrders),
      latestOrders: buildLatestOrders(latestOrders),
      recentCashActivities: buildRecentCashActivities(recentCashTransactions),
      lowStockItems: lowStockRows,
      productionSummary: {
        productionOrdersThisMonth: productionOrderCountThisMonth,
        completedProduction,
        totalProductionCost,
        finishedGoodsProduced,
      },
      contentPlannerSummary,
      upcomingContent: contentPlannerThisMonth.slice(0, 3),
      cashPositionSummary: cashPositionReport?.accountSummary || [],
    };
  }

  async getExecutiveDashboard({ range = 'last30', from = '', to = '' } = {}) {
    const [summary, details] = await Promise.all([
      this.getExecutiveDashboardSummary({ range, from, to }),
      this.getExecutiveDashboardDetails({ range, from, to }),
    ]);

    return {
      period: summary.period,
      kpis: summary.kpis,
      ...details,
    };
  }
}

export const dashboardService = new DashboardService();
