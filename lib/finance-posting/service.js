import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { FinancePostingError } from './errors';

const SALES_JOURNAL_SOURCE = 'Sales';
const COGS_JOURNAL_SOURCE = 'COGS';
const PRODUCTION_JOURNAL_SOURCE = 'Production';
const SALES_JOURNAL_TYPE = 'System';
const SALES_JOURNAL_CREATED_BY = 'System';
const CASH_ACCOUNT_CODES = ['1200', '1100'];
const SALES_REVENUE_ACCOUNT_CODE = '4100';
const COGS_ACCOUNT_CODE = '5000';
const FINISHED_GOODS_INVENTORY_ACCOUNT_CODE = '1500';
const RAW_MATERIAL_INVENTORY_ACCOUNT_CODE = '1400';
const MANUFACTURING_CLEARING_ACCOUNT_CODE = '6200';

function formatJournalDate(value) {
  const date = value instanceof Date ? value : new Date(value || new Date());
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }

  return date.toISOString().split('T')[0];
}

function buildSalesJournalDescription(order) {
  return `Sales transaction for Order ${order.orderNumber}`;
}

function buildCogsJournalDescription(order, orderItems) {
  const orderReference = order.publicOrderNumber || order.orderNumber;
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return `Automatic COGS Recognition · Order: ${orderReference}`;
  }

  if (orderItems.length === 1) {
    const item = orderItems[0];
    return `Automatic COGS Recognition · Order: ${orderReference} · Product: ${item.productName} · Qty: ${item.quantity}`;
  }

  const itemSummary = orderItems
    .map((item) => `${item.productName} x${item.quantity}`)
    .join(', ');
  return `Automatic COGS Recognition · Order: ${orderReference} · Items: ${itemSummary}`;
}

function buildProductionJournalDescription(result) {
  const productName = result?.productionOrder?.product?.name || result?.productName || 'Unknown Product';
  const quantity = Number(result?.productionOrder?.actualQuantity || result?.actualQuantity || 0);
  return `Production Result ${result.resultNumber} · Product: ${productName} · Produced ${quantity.toLocaleString('id-ID')} pcs`;
}

function logSalesJournalPosted({ orderNumber = '', amount = 0, journalNumber = '' }) {
  console.info('[FINANCE]', {
    eventName: 'Sales Journal Posted',
    orderNumber,
    amount,
    journalNumber,
    timestamp: new Date().toISOString(),
  });
}

function logCogsJournalPosted({ orderNumber = '', amount = 0, journalNumber = '' }) {
  console.info('[FINANCE]', {
    eventName: 'COGS Journal Posted',
    orderNumber,
    amount,
    journalNumber,
    timestamp: new Date().toISOString(),
  });
}

function logProductionJournalPosted({ resultNumber = '', amount = 0, journalNumber = '' }) {
  console.info('[FINANCE]', {
    eventName: 'Production Journal Posted',
    resultNumber,
    amount,
    journalNumber,
    timestamp: new Date().toISOString(),
  });
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

export class FinancePostingService {
  constructor({
    prismaClient = prisma,
    idGenerator = uuid,
    nowFactory = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.idGenerator = idGenerator;
    this.nowFactory = nowFactory;
  }

  async generateJournalNumber(prismaClient, journalDate) {
    const [year, month] = formatJournalDate(journalDate).split('-');
    const prefix = `JR-${year}${month}-`;

    const existing = await prismaClient.journalEntry.findMany({
      where: { journalNumber: { startsWith: prefix } },
      select: { journalNumber: true },
      orderBy: { journalNumber: 'desc' },
    });

    let maxSeq = 0;
    for (const entry of existing) {
      const parts = entry.journalNumber.split('-');
      const seq = Number.parseInt(parts[parts.length - 1] || '0', 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
  }

  async findExistingSalesJournal(orderId) {
    return this.prisma.journalEntry.findFirst({
      where: {
        journalSource: SALES_JOURNAL_SOURCE,
        journalType: SALES_JOURNAL_TYPE,
        sourceId: orderId,
      },
      include: {
        lines: true,
      },
    });
  }

  async resolveCashOrBankAccount(prismaClient) {
    const linkedFinancialAccount = await prismaClient.financialAccount.findFirst({
      where: {
        isActive: true,
        linkedCoaId: { not: null },
      },
      include: {
        linkedCoa: true,
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
    });

    if (linkedFinancialAccount?.linkedCoa?.isActive && linkedFinancialAccount.linkedCoa.allowTransaction) {
      return linkedFinancialAccount.linkedCoa;
    }

    for (const accountCode of CASH_ACCOUNT_CODES) {
      const account = await prismaClient.chartOfAccount.findFirst({
        where: {
          accountCode,
          isActive: true,
          allowTransaction: true,
        },
      });

      if (account) {
        return account;
      }
    }

    const fallbackAccount = await prismaClient.chartOfAccount.findFirst({
      where: {
        isActive: true,
        allowTransaction: true,
        accountType: 'Asset',
        OR: [
          { accountName: { contains: 'Bank', mode: 'insensitive' } },
          { accountName: { contains: 'Cash', mode: 'insensitive' } },
        ],
      },
      orderBy: { accountCode: 'asc' },
    });

    if (fallbackAccount) {
      return fallbackAccount;
    }

    throw new FinancePostingError({
      message: 'Cash or Bank account mapping could not be resolved.',
      code: 'FINANCE_POSTING_CASH_ACCOUNT_NOT_FOUND',
    });
  }

  async resolveSalesRevenueAccount(prismaClient) {
    const directAccount = await prismaClient.chartOfAccount.findFirst({
      where: {
        accountCode: SALES_REVENUE_ACCOUNT_CODE,
        isActive: true,
        allowTransaction: true,
      },
    });

    if (directAccount) {
      return directAccount;
    }

    const fallbackAccount = await prismaClient.chartOfAccount.findFirst({
      where: {
        isActive: true,
        allowTransaction: true,
        accountType: 'Revenue',
        OR: [
          { accountName: { contains: 'Sales', mode: 'insensitive' } },
          { accountName: { contains: 'Revenue', mode: 'insensitive' } },
        ],
      },
      orderBy: { accountCode: 'asc' },
    });

    if (fallbackAccount) {
      return fallbackAccount;
    }

    throw new FinancePostingError({
      message: 'Sales Revenue account mapping could not be resolved.',
      code: 'FINANCE_POSTING_REVENUE_ACCOUNT_NOT_FOUND',
    });
  }

  async findExistingCogsJournal(orderId) {
    return this.prisma.journalEntry.findFirst({
      where: {
        journalSource: COGS_JOURNAL_SOURCE,
        journalType: SALES_JOURNAL_TYPE,
        sourceId: orderId,
      },
      include: {
        lines: true,
      },
    });
  }

  async resolveCogsAccount(prismaClient) {
    const directAccount = await prismaClient.chartOfAccount.findFirst({
      where: {
        accountCode: COGS_ACCOUNT_CODE,
        isActive: true,
        allowTransaction: true,
      },
    });

    if (directAccount) {
      return directAccount;
    }

    const fallbackAccount = await prismaClient.chartOfAccount.findFirst({
      where: {
        isActive: true,
        allowTransaction: true,
        accountType: 'Expense',
        OR: [
          { accountName: { contains: 'Cost of Goods Sold', mode: 'insensitive' } },
          { accountName: { contains: 'COGS', mode: 'insensitive' } },
        ],
      },
      orderBy: { accountCode: 'asc' },
    });

    if (fallbackAccount) {
      return fallbackAccount;
    }

    throw new FinancePostingError({
      message: 'COGS account mapping could not be resolved.',
      code: 'FINANCE_POSTING_COGS_ACCOUNT_NOT_FOUND',
    });
  }

  async resolveFinishedGoodsInventoryAccount(prismaClient) {
    const directAccount = await prismaClient.chartOfAccount.findFirst({
      where: {
        accountCode: FINISHED_GOODS_INVENTORY_ACCOUNT_CODE,
        isActive: true,
        allowTransaction: true,
      },
    });

    if (directAccount) {
      return directAccount;
    }

    const fallbackAccount = await prismaClient.chartOfAccount.findFirst({
      where: {
        isActive: true,
        allowTransaction: true,
        accountType: 'Asset',
        OR: [
          { accountName: { contains: 'Finished Goods Inventory', mode: 'insensitive' } },
          { accountName: { contains: 'Inventory', mode: 'insensitive' } },
        ],
      },
      orderBy: { accountCode: 'asc' },
    });

    if (fallbackAccount) {
      return fallbackAccount;
    }

    throw new FinancePostingError({
      message: 'Finished goods inventory account mapping could not be resolved.',
      code: 'FINANCE_POSTING_FINISHED_GOODS_ACCOUNT_NOT_FOUND',
    });
  }

  async resolveRawMaterialInventoryAccount(prismaClient) {
    const directAccount = await prismaClient.chartOfAccount.findFirst({
      where: {
        accountCode: RAW_MATERIAL_INVENTORY_ACCOUNT_CODE,
        isActive: true,
        allowTransaction: true,
      },
    });

    if (directAccount) {
      return directAccount;
    }

    const fallbackAccount = await prismaClient.chartOfAccount.findFirst({
      where: {
        isActive: true,
        allowTransaction: true,
        accountType: 'Asset',
        OR: [
          { accountName: { contains: 'Raw Material Inventory', mode: 'insensitive' } },
          { accountName: { contains: 'Raw Material', mode: 'insensitive' } },
        ],
      },
      orderBy: { accountCode: 'asc' },
    });

    if (fallbackAccount) {
      return fallbackAccount;
    }

    throw new FinancePostingError({
      message: 'Raw material inventory account mapping could not be resolved.',
      code: 'FINANCE_POSTING_RAW_MATERIAL_ACCOUNT_NOT_FOUND',
    });
  }

  async resolveManufacturingClearingAccount(prismaClient) {
    const directAccount = await prismaClient.chartOfAccount.findFirst({
      where: {
        accountCode: MANUFACTURING_CLEARING_ACCOUNT_CODE,
        isActive: true,
        allowTransaction: true,
      },
    });

    if (directAccount) {
      return directAccount;
    }

    const fallbackAccount = await prismaClient.chartOfAccount.findFirst({
      where: {
        isActive: true,
        allowTransaction: true,
        OR: [
          { accountName: { contains: 'Manufacturing', mode: 'insensitive' } },
          { accountName: { contains: 'Production', mode: 'insensitive' } },
          { accountName: { contains: 'Overhead', mode: 'insensitive' } },
          { accountName: { contains: 'Operational Expense', mode: 'insensitive' } },
        ],
      },
      orderBy: { accountCode: 'asc' },
    });

    if (fallbackAccount) {
      return fallbackAccount;
    }

    throw new FinancePostingError({
      message: 'Manufacturing clearing account mapping could not be resolved.',
      code: 'FINANCE_POSTING_MANUFACTURING_CLEARING_ACCOUNT_NOT_FOUND',
    });
  }

  async findExistingProductionResultJournal(resultId, prismaClient = this.prisma) {
    return prismaClient.journalEntry.findFirst({
      where: {
        journalSource: PRODUCTION_JOURNAL_SOURCE,
        journalType: SALES_JOURNAL_TYPE,
        sourceId: resultId,
      },
      include: {
        lines: true,
      },
    });
  }

  async buildCogsOrderItems(prismaClient, order) {
    const orderItems = Array.isArray(order?.items) ? order.items : [];
    if (orderItems.length === 0) {
      throw new FinancePostingError({
        message: 'Order items are required for COGS journal posting.',
        statusCode: 400,
        code: 'FINANCE_POSTING_ORDER_ITEMS_REQUIRED',
      });
    }

    const productIds = [...new Set(orderItems.map((item) => item.productId).filter(Boolean))];
    const products = productIds.length > 0
      ? await prismaClient.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            costPrice: true,
          },
        })
      : [];
    const productMap = new Map(products.map((product) => [product.id, product]));

    const normalizedItems = orderItems.map((item) => {
      const product = productMap.get(item.productId) || null;
      const unitCost = Number(item.costPrice ?? product?.costPrice ?? 0);
      const quantity = Number(item.quantity || 0);
      const lineAmount = unitCost * quantity;
      return {
        productId: item.productId,
        productName: item.productName || product?.name || 'Unknown Product',
        quantity,
        unitCost,
        lineAmount,
      };
    });

    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.lineAmount, 0);
    return {
      items: normalizedItems,
      totalAmount,
    };
  }

  async postProductionResultJournal(productionResult, { prismaClient } = {}) {
    const client = prismaClient || this.prisma;

    if (!productionResult?.id) {
      throw new FinancePostingError({
        message: 'Production result is required for journal posting.',
        statusCode: 400,
        code: 'FINANCE_POSTING_PRODUCTION_RESULT_REQUIRED',
      });
    }

    const existingJournal = await this.findExistingProductionResultJournal(productionResult.id, client);
    if (existingJournal) {
      return {
        journal: existingJournal,
        action: 'FOUND',
      };
    }

    const totalMaterialCost = Number(productionResult.totalMaterialCost || 0);
    const totalProductionCost = Number(productionResult.totalProductionCost || 0);
    const additionalCost = Number(
      (productionResult.laborCost || 0)
      + (productionResult.factoryOverheadCost || 0)
      + (productionResult.otherCost || 0),
    );

    if (!Number.isFinite(totalProductionCost) || totalProductionCost <= 0) {
      throw new FinancePostingError({
        message: 'Production result total cost is invalid for journal posting.',
        statusCode: 400,
        code: 'FINANCE_POSTING_PRODUCTION_COST_INVALID',
      });
    }

    const journalDate = formatJournalDate(
      productionResult.productionOrder?.completedAt
        || productionResult.createdAt
        || this.nowFactory(),
    );

    const finishedGoodsInventoryAccount = await this.resolveFinishedGoodsInventoryAccount(client);
    const rawMaterialInventoryAccount = await this.resolveRawMaterialInventoryAccount(client);
    const manufacturingClearingAccount = additionalCost > 0
      ? await this.resolveManufacturingClearingAccount(client)
      : null;
    const journalNumber = await this.generateJournalNumber(client, journalDate);
    const description = buildProductionJournalDescription(productionResult);

    const lines = [
      {
        id: this.idGenerator(),
        chartOfAccountId: finishedGoodsInventoryAccount.id,
        description,
        debitAmount: totalProductionCost,
        creditAmount: 0,
      },
    ];

    if (totalMaterialCost > 0) {
      lines.push({
        id: this.idGenerator(),
        chartOfAccountId: rawMaterialInventoryAccount.id,
        description,
        debitAmount: 0,
        creditAmount: totalMaterialCost,
      });
    }

    if (manufacturingClearingAccount && additionalCost > 0) {
      lines.push({
        id: this.idGenerator(),
        chartOfAccountId: manufacturingClearingAccount.id,
        description,
        debitAmount: 0,
        creditAmount: additionalCost,
      });
    }

    const journal = await client.journalEntry.create({
      data: {
        id: this.idGenerator(),
        journalNumber,
        journalDate,
        description,
        referenceNumber: productionResult.resultNumber,
        journalSource: PRODUCTION_JOURNAL_SOURCE,
        sourceId: productionResult.id,
        journalType: SALES_JOURNAL_TYPE,
        status: 'Posted',
        totalDebit: totalProductionCost,
        totalCredit: totalProductionCost,
        createdBy: SALES_JOURNAL_CREATED_BY,
        updatedBy: SALES_JOURNAL_CREATED_BY,
        lines: {
          create: lines,
        },
      },
      include: {
        lines: true,
      },
    });

    logProductionJournalPosted({
      resultNumber: productionResult.resultNumber,
      amount: totalProductionCost,
      journalNumber: journal.journalNumber,
    });

    return {
      journal,
      action: 'CREATED',
    };
  }

  async postSalesJournal(order) {
    if (!order?.id) {
      throw new FinancePostingError({
        message: 'Order is required for sales journal posting.',
        statusCode: 400,
        code: 'FINANCE_POSTING_ORDER_REQUIRED',
      });
    }

    const existingJournal = await this.findExistingSalesJournal(order.id);
    if (existingJournal) {
      return {
        journal: existingJournal,
        action: 'FOUND',
      };
    }

    const amount = Number(order.grandTotal || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new FinancePostingError({
        message: 'Order grand total is invalid for sales journal posting.',
        statusCode: 400,
        code: 'FINANCE_POSTING_ORDER_AMOUNT_INVALID',
      });
    }

    const journalDate = formatJournalDate(order.paymentAttempt?.settlementTime || order.createdAt || this.nowFactory());

    try {
      const journal = await this.prisma.$transaction(async (tx) => {
        const cashOrBankAccount = await this.resolveCashOrBankAccount(tx);
        const salesRevenueAccount = await this.resolveSalesRevenueAccount(tx);
        const journalNumber = await this.generateJournalNumber(tx, journalDate);
        const description = buildSalesJournalDescription(order);

        return tx.journalEntry.create({
          data: {
            id: this.idGenerator(),
            journalNumber,
            journalDate,
            description,
            referenceNumber: order.orderNumber,
            journalSource: SALES_JOURNAL_SOURCE,
            sourceId: order.id,
            journalType: SALES_JOURNAL_TYPE,
            status: 'Posted',
            totalDebit: amount,
            totalCredit: amount,
            createdBy: SALES_JOURNAL_CREATED_BY,
            updatedBy: SALES_JOURNAL_CREATED_BY,
            lines: {
              create: [
                {
                  id: this.idGenerator(),
                  chartOfAccountId: cashOrBankAccount.id,
                  description,
                  debitAmount: amount,
                  creditAmount: 0,
                },
                {
                  id: this.idGenerator(),
                  chartOfAccountId: salesRevenueAccount.id,
                  description,
                  debitAmount: 0,
                  creditAmount: amount,
                },
              ],
            },
          },
          include: {
            lines: true,
          },
        });
      });

      logSalesJournalPosted({
        orderNumber: order.orderNumber,
        amount,
        journalNumber: journal.journalNumber,
      });

      return {
        journal,
        action: 'CREATED',
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const concurrentJournal = await this.findExistingSalesJournal(order.id);
        if (concurrentJournal) {
          return {
            journal: concurrentJournal,
            action: 'FOUND',
          };
        }
      }

      throw error;
    }
  }

  async postCogsJournal(order) {
    if (!order?.id) {
      throw new FinancePostingError({
        message: 'Order is required for COGS journal posting.',
        statusCode: 400,
        code: 'FINANCE_POSTING_ORDER_REQUIRED',
      });
    }

    const existingJournal = await this.findExistingCogsJournal(order.id);
    if (existingJournal) {
      return {
        journal: existingJournal,
        action: 'FOUND',
      };
    }

    const journalDate = formatJournalDate(order.paymentAttempt?.settlementTime || order.createdAt || this.nowFactory());

    try {
      const journal = await this.prisma.$transaction(async (tx) => {
        const cogsAccount = await this.resolveCogsAccount(tx);
        const inventoryAssetAccount = await this.resolveFinishedGoodsInventoryAccount(tx);
        const { items, totalAmount } = await this.buildCogsOrderItems(tx, order);

        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
          throw new FinancePostingError({
            message: 'Order cost is invalid for COGS journal posting.',
            statusCode: 400,
            code: 'FINANCE_POSTING_COGS_AMOUNT_INVALID',
          });
        }

        const journalNumber = await this.generateJournalNumber(tx, journalDate);
        const description = buildCogsJournalDescription(order, items);

        return tx.journalEntry.create({
          data: {
            id: this.idGenerator(),
            journalNumber,
            journalDate,
            description,
            referenceNumber: order.orderNumber,
            journalSource: COGS_JOURNAL_SOURCE,
            sourceId: order.id,
            journalType: SALES_JOURNAL_TYPE,
            status: 'Posted',
            totalDebit: totalAmount,
            totalCredit: totalAmount,
            createdBy: SALES_JOURNAL_CREATED_BY,
            updatedBy: SALES_JOURNAL_CREATED_BY,
            lines: {
              create: [
                {
                  id: this.idGenerator(),
                  chartOfAccountId: cogsAccount.id,
                  description,
                  debitAmount: totalAmount,
                  creditAmount: 0,
                },
                {
                  id: this.idGenerator(),
                  chartOfAccountId: inventoryAssetAccount.id,
                  description,
                  debitAmount: 0,
                  creditAmount: totalAmount,
                },
              ],
            },
          },
          include: {
            lines: true,
          },
        });
      });

      logCogsJournalPosted({
        orderNumber: order.orderNumber,
        amount: journal.totalDebit,
        journalNumber: journal.journalNumber,
      });

      return {
        journal,
        action: 'CREATED',
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const concurrentJournal = await this.findExistingCogsJournal(order.id);
        if (concurrentJournal) {
          return {
            journal: concurrentJournal,
            action: 'FOUND',
          };
        }
      }

      throw error;
    }
  }
}

export const financePostingService = new FinancePostingService();
