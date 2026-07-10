import { prisma } from '@/lib/prisma';

function normalizeDateValue(value) {
  const normalized = String(value || '').trim();
  return normalized || '';
}

function isSameOrAfter(dateString, boundary) {
  return !boundary || String(dateString || '') >= boundary;
}

function isSameOrBefore(dateString, boundary) {
  return !boundary || String(dateString || '') <= boundary;
}

function classifyCashDirection(account, line) {
  const debitAmount = Number(line.debitAmount || 0);
  const creditAmount = Number(line.creditAmount || 0);
  const normalBalance = String(account?.normalBalance || 'Debit');

  if (normalBalance === 'Credit') {
    return {
      inflow: creditAmount,
      outflow: debitAmount,
    };
  }

  return {
    inflow: debitAmount,
    outflow: creditAmount,
  };
}

function buildSourceLabel(journalSource, cashTransaction) {
  const normalized = String(journalSource || '').trim();
  if (normalized === 'Sales') {
    return 'Sales Receipt';
  }

  if (normalized === 'Cash Out') {
    const categoryName = String(
      cashTransaction?.expenseCategoryName
      || cashTransaction?.expenseCategory?.name
      || '',
    ).trim();

    if (categoryName) {
      return categoryName;
    }
  }

  return normalized || 'General';
}

function sortRows(rows) {
  return [...rows].sort((left, right) => {
    if (left.journalDate !== right.journalDate) {
      return String(left.journalDate).localeCompare(String(right.journalDate));
    }

    return String(left.referenceNumber || '').localeCompare(String(right.referenceNumber || ''));
  });
}

export class CashFlowService {
  constructor({ prismaClient = prisma } = {}) {
    this.prisma = prismaClient;
  }

  async buildReport({ from = '', to = '', financialAccountId = '' } = {}) {
    const normalizedFrom = normalizeDateValue(from);
    const normalizedTo = normalizeDateValue(to);
    const normalizedFinancialAccountId = String(financialAccountId || '').trim();

    const financialAccounts = await this.prisma.financialAccount.findMany({
      where: {
        isActive: true,
        ...(normalizedFinancialAccountId ? { id: normalizedFinancialAccountId } : {}),
      },
      include: {
        linkedCoa: true,
      },
      orderBy: { name: 'asc' },
    });

    const linkedAccounts = financialAccounts.filter((account) => account.linkedCoaId && account.linkedCoa);
    const cashAccountIds = linkedAccounts.map((account) => account.linkedCoaId);

    if (cashAccountIds.length === 0) {
      return {
        inflows: [],
        outflows: [],
        totalInflows: 0,
        totalOutflows: 0,
        netCashFlow: 0,
        accountSummary: financialAccounts.map((account) => ({
          id: account.id,
          name: account.name,
          type: account.type,
          openingBalance: account.openingBalance || 0,
          totalIn: 0,
          totalOut: 0,
          closingBalance: account.openingBalance || 0,
        })),
        openingCashPosition: financialAccounts.reduce((sum, account) => sum + (account.openingBalance || 0), 0),
        closingCashPosition: financialAccounts.reduce((sum, account) => sum + (account.openingBalance || 0), 0),
        calculatedClosing: financialAccounts.reduce((sum, account) => sum + (account.openingBalance || 0), 0),
        isValid: true,
        validationDiff: 0,
      };
    }

    const journalLines = await this.prisma.journalEntryLine.findMany({
      where: {
        chartOfAccountId: { in: cashAccountIds },
        journalEntry: {
          status: 'Posted',
        },
      },
      include: {
        chartOfAccount: true,
        journalEntry: {
          select: {
            id: true,
            journalNumber: true,
            journalDate: true,
            journalSource: true,
            referenceNumber: true,
            sourceId: true,
            description: true,
          },
        },
      },
      orderBy: [
        { journalEntry: { journalDate: 'asc' } },
        { journalEntry: { journalNumber: 'asc' } },
      ],
    });

    const cashOutSourceIds = [...new Set(
      journalLines
        .filter((line) => line.journalEntry?.journalSource === 'Cash Out' && line.journalEntry?.sourceId)
        .map((line) => line.journalEntry.sourceId),
    )];

    const cashOutTransactions = cashOutSourceIds.length && this.prisma.cashTransaction?.findMany
      ? await this.prisma.cashTransaction.findMany({
          where: { id: { in: cashOutSourceIds } },
          select: {
            id: true,
            expenseCategoryName: true,
            expenseCategory: { select: { name: true } },
          },
        })
      : [];
    const cashOutMap = new Map(cashOutTransactions.map((transaction) => [transaction.id, transaction]));

    const cashLines = journalLines.map((line) => {
      const financialAccount = linkedAccounts.find((account) => account.linkedCoaId === line.chartOfAccountId) || null;
      const { inflow, outflow } = classifyCashDirection(line.chartOfAccount, line);
      const cashTransaction = cashOutMap.get(line.journalEntry.sourceId) || null;

      return {
        journalEntryId: line.journalEntry.id,
        journalNumber: line.journalEntry.journalNumber,
        journalDate: line.journalEntry.journalDate,
        journalSource: line.journalEntry.journalSource,
        sourceLabel: buildSourceLabel(line.journalEntry.journalSource, cashTransaction),
        referenceNumber: line.journalEntry.referenceNumber,
        sourceId: line.journalEntry.sourceId,
        description: line.description?.trim() || line.journalEntry.description,
        accountId: line.chartOfAccountId,
        accountCode: line.chartOfAccount.accountCode,
        accountName: line.chartOfAccount.accountName,
        financialAccountId: financialAccount?.id || '',
        financialAccountName: financialAccount?.name || line.chartOfAccount.accountName,
        inflow,
        outflow,
      };
    });

    const previousLines = cashLines.filter((line) => normalizedFrom && String(line.journalDate || '') < normalizedFrom);
    const currentLines = cashLines.filter((line) => isSameOrAfter(line.journalDate, normalizedFrom) && isSameOrBefore(line.journalDate, normalizedTo));

    const inflows = sortRows(currentLines.filter((line) => line.inflow > 0).map((line) => ({
      id: `${line.journalEntryId}-inflow-${line.accountId}`,
      coaId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      financialAccountId: line.financialAccountId,
      financialAccountName: line.financialAccountName,
      journalNumber: line.journalNumber,
      journalDate: line.journalDate,
      source: line.sourceLabel,
      sourceId: line.sourceId,
      referenceNumber: line.referenceNumber,
      count: 1,
      amount: line.inflow,
      description: line.description,
    })));

    const outflows = sortRows(currentLines.filter((line) => line.outflow > 0).map((line) => ({
      id: `${line.journalEntryId}-outflow-${line.accountId}`,
      coaId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      financialAccountId: line.financialAccountId,
      financialAccountName: line.financialAccountName,
      journalNumber: line.journalNumber,
      journalDate: line.journalDate,
      source: line.sourceLabel,
      sourceId: line.sourceId,
      referenceNumber: line.referenceNumber,
      count: 1,
      amount: line.outflow,
      description: line.description,
    })));

    const totalInflows = inflows.reduce((sum, row) => sum + row.amount, 0);
    const totalOutflows = outflows.reduce((sum, row) => sum + row.amount, 0);
    const netCashFlow = totalInflows - totalOutflows;

    const accountSummary = linkedAccounts.map((account) => {
      const accountPrevious = previousLines.filter((line) => line.financialAccountId === account.id);
      const accountCurrent = currentLines.filter((line) => line.financialAccountId === account.id);
      const previousInflows = accountPrevious.reduce((sum, line) => sum + line.inflow, 0);
      const previousOutflows = accountPrevious.reduce((sum, line) => sum + line.outflow, 0);
      const openingBalance = (account.openingBalance || 0) + previousInflows - previousOutflows;
      const totalIn = accountCurrent.reduce((sum, line) => sum + line.inflow, 0);
      const totalOut = accountCurrent.reduce((sum, line) => sum + line.outflow, 0);
      const closingBalance = openingBalance + totalIn - totalOut;

      return {
        id: account.id,
        name: account.name,
        type: account.type,
        openingBalance,
        totalIn,
        totalOut,
        closingBalance,
      };
    });

    const openingCashPosition = accountSummary.reduce((sum, account) => sum + account.openingBalance, 0);
    const closingCashPosition = accountSummary.reduce((sum, account) => sum + account.closingBalance, 0);
    const calculatedClosing = openingCashPosition + totalInflows - totalOutflows;
    const validationDiff = Math.abs(calculatedClosing - closingCashPosition);
    const isValid = validationDiff < 0.01;

    return {
      inflows,
      outflows,
      totalInflows,
      totalOutflows,
      netCashFlow,
      accountSummary,
      openingCashPosition,
      closingCashPosition,
      calculatedClosing,
      isValid,
      validationDiff,
    };
  }
}

export const cashFlowService = new CashFlowService();
