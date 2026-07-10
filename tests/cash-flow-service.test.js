import test from 'node:test';
import assert from 'node:assert/strict';
import { CashFlowService } from '../lib/finance-reporting/cash-flow-service.js';

function createService() {
  const financialAccounts = [
    {
      id: 'financial-account-1',
      name: 'Bank BCA',
      type: 'Bank',
      openingBalance: 100000,
      linkedCoaId: 'coa-bank',
      linkedCoa: {
        id: 'coa-bank',
        accountCode: '1200',
        accountName: 'Bank',
        normalBalance: 'Debit',
      },
    },
  ];

  const journalLines = [
    {
      chartOfAccountId: 'coa-bank',
      debitAmount: 0,
      creditAmount: 20000,
      chartOfAccount: {
        id: 'coa-bank',
        accountCode: '1200',
        accountName: 'Bank',
        normalBalance: 'Debit',
      },
      journalEntry: {
        id: 'journal-before',
        journalNumber: 'JR-202606-00001',
        journalDate: '2026-06-30',
        journalSource: 'Cash Out',
        referenceNumber: 'CO-00001',
        sourceId: 'cash-out-1',
        description: 'Cash out before period',
      },
    },
    {
      chartOfAccountId: 'coa-bank',
      debitAmount: 189000,
      creditAmount: 0,
      chartOfAccount: {
        id: 'coa-bank',
        accountCode: '1200',
        accountName: 'Bank',
        normalBalance: 'Debit',
      },
      journalEntry: {
        id: 'journal-sales',
        journalNumber: 'JR-202607-00001',
        journalDate: '2026-07-10',
        journalSource: 'Sales',
        referenceNumber: 'ORD-202607-00012',
        sourceId: 'order-1',
        description: 'Sales transaction for Order ORD-202607-00012',
      },
    },
    {
      chartOfAccountId: 'coa-bank',
      debitAmount: 0,
      creditAmount: 50000,
      chartOfAccount: {
        id: 'coa-bank',
        accountCode: '1200',
        accountName: 'Bank',
        normalBalance: 'Debit',
      },
      journalEntry: {
        id: 'journal-cash-out',
        journalNumber: 'JR-202607-00002',
        journalDate: '2026-07-11',
        journalSource: 'Cash Out',
        referenceNumber: 'CO-00002',
        sourceId: 'cash-out-2',
        description: 'Cash out in period',
      },
    },
  ];

  const cashTransactions = [
    {
      id: 'cash-out-1',
      expenseCategoryName: 'Operational',
      expenseCategory: { name: 'Operational' },
    },
    {
      id: 'cash-out-2',
      expenseCategoryName: 'Marketing',
      expenseCategory: { name: 'Marketing' },
    },
  ];

  const prismaClient = {
    financialAccount: {
      findMany: async ({ where }) => {
        return financialAccounts.filter((account) => !where?.id || account.id === where.id);
      },
    },
    journalEntryLine: {
      findMany: async () => journalLines,
    },
    cashTransaction: {
      findMany: async ({ where }) => cashTransactions.filter((transaction) => where?.id?.in?.includes(transaction.id)),
    },
  };

  return new CashFlowService({ prismaClient });
}

test('derives cash inflows and outflows from posted journal entries', async () => {
  const service = createService();
  const report = await service.buildReport({ from: '2026-07-01', to: '2026-07-31' });

  assert.equal(report.inflows.length, 1);
  assert.equal(report.inflows[0].source, 'Sales Receipt');
  assert.equal(report.inflows[0].referenceNumber, 'ORD-202607-00012');
  assert.equal(report.inflows[0].amount, 189000);

  assert.equal(report.outflows.length, 1);
  assert.equal(report.outflows[0].source, 'Marketing');
  assert.equal(report.outflows[0].amount, 50000);

  assert.equal(report.totalInflows, 189000);
  assert.equal(report.totalOutflows, 50000);
  assert.equal(report.netCashFlow, 139000);
});

test('calculates opening and closing balances per financial account from journals', async () => {
  const service = createService();
  const report = await service.buildReport({ from: '2026-07-01', to: '2026-07-31' });

  assert.equal(report.accountSummary.length, 1);
  assert.equal(report.accountSummary[0].openingBalance, 80000);
  assert.equal(report.accountSummary[0].totalIn, 189000);
  assert.equal(report.accountSummary[0].totalOut, 50000);
  assert.equal(report.accountSummary[0].closingBalance, 219000);
  assert.equal(report.openingCashPosition, 80000);
  assert.equal(report.closingCashPosition, 219000);
  assert.equal(report.calculatedClosing, 219000);
  assert.equal(report.isValid, true);
});

test('supports filtering by financial account', async () => {
  const service = createService();
  const report = await service.buildReport({
    from: '2026-07-01',
    to: '2026-07-31',
    financialAccountId: 'financial-account-1',
  });

  assert.equal(report.accountSummary.length, 1);
  assert.equal(report.inflows.length, 1);
  assert.equal(report.outflows.length, 1);
});
