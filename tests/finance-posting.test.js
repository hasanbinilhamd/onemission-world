import test from 'node:test';
import assert from 'node:assert/strict';
import { FinancePostingService } from '../lib/finance-posting/service.js';

function createService({ existingJournal = null, linkedCoa = null } = {}) {
  const store = {
    journals: existingJournal ? [existingJournal] : [],
    createdJournal: null,
  };

  const chartOfAccounts = [
    { id: 'coa-bank', accountCode: '1200', accountName: 'Bank', accountType: 'Asset', isActive: true, allowTransaction: true },
    { id: 'coa-cash', accountCode: '1100', accountName: 'Cash', accountType: 'Asset', isActive: true, allowTransaction: true },
    { id: 'coa-sales', accountCode: '4100', accountName: 'Product Sales', accountType: 'Revenue', isActive: true, allowTransaction: true },
  ];

  const prismaClient = {
    journalEntry: {
      findFirst: async ({ where }) => store.journals.find((journal) => (
        journal.journalSource === where.journalSource
        && journal.journalType === where.journalType
        && journal.sourceId === where.sourceId
      )) || null,
      findMany: async () => store.journals.map((journal) => ({ journalNumber: journal.journalNumber })),
      create: async ({ data }) => {
        const created = {
          ...data,
          lines: data.lines.create,
        };
        store.createdJournal = created;
        store.journals.push(created);
        return created;
      },
    },
    financialAccount: {
      findFirst: async () => linkedCoa ? {
        id: 'financial-account-1',
        name: 'Bank BCA',
        linkedCoa,
      } : null,
    },
    chartOfAccount: {
      findFirst: async ({ where }) => {
        return chartOfAccounts.find((account) => {
          if (where.accountCode && account.accountCode !== where.accountCode) {
            return false;
          }
          if (where.accountType && account.accountType !== where.accountType) {
            return false;
          }
          if (where.isActive !== undefined && account.isActive !== where.isActive) {
            return false;
          }
          if (where.allowTransaction !== undefined && account.allowTransaction !== where.allowTransaction) {
            return false;
          }
          return true;
        }) || null;
      },
    },
    $transaction: async (callback) => callback(prismaClient),
  };

  const service = new FinancePostingService({
    prismaClient,
    idGenerator: () => 'generated-id',
    nowFactory: () => new Date('2026-07-10T00:00:00.000Z'),
  });

  return { service, store };
}

test('posts a sales journal for a paid order', async () => {
  const { service, store } = createService();
  const order = {
    id: 'order-1',
    orderNumber: 'ORD-202607-00012',
    grandTotal: 189000,
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    paymentAttempt: {
      settlementTime: new Date('2026-07-10T00:05:00.000Z'),
    },
  };

  const result = await service.postSalesJournal(order);

  assert.equal(result.action, 'CREATED');
  assert.equal(store.createdJournal.referenceNumber, 'ORD-202607-00012');
  assert.equal(store.createdJournal.journalSource, 'Sales');
  assert.equal(store.createdJournal.sourceId, 'order-1');
  assert.equal(store.createdJournal.status, 'Posted');
  assert.equal(store.createdJournal.totalDebit, 189000);
  assert.equal(store.createdJournal.totalCredit, 189000);
  assert.equal(store.createdJournal.lines.length, 2);
  assert.equal(store.createdJournal.lines[0].debitAmount, 189000);
  assert.equal(store.createdJournal.lines[0].creditAmount, 0);
  assert.equal(store.createdJournal.lines[1].debitAmount, 0);
  assert.equal(store.createdJournal.lines[1].creditAmount, 189000);
});

test('reuses an existing sales journal for duplicate posting', async () => {
  const existingJournal = {
    id: 'journal-1',
    journalNumber: 'JR-202607-00001',
    journalSource: 'Sales',
    journalType: 'System',
    sourceId: 'order-1',
    lines: [],
  };

  const { service, store } = createService({ existingJournal });
  const order = {
    id: 'order-1',
    orderNumber: 'ORD-202607-00012',
    grandTotal: 189000,
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    paymentAttempt: {
      settlementTime: new Date('2026-07-10T00:05:00.000Z'),
    },
  };

  const result = await service.postSalesJournal(order);

  assert.equal(result.action, 'FOUND');
  assert.equal(store.journals.length, 1);
});
