import test from 'node:test';
import assert from 'node:assert/strict';
import { DashboardService } from '../lib/dashboard/service.js';
import { calculateProfitLossForPeriod, isCogsAccount } from '../lib/finance-reporting/profit-loss-service.js';

test('Revenue Reconciliation', async (t) => {
  await t.test('isCogsAccount logic matches legacy Finance logic', () => {
    assert.equal(isCogsAccount({ accountCode: '5000', accountName: 'COGS' }), true);
    assert.equal(isCogsAccount({ accountCode: '4000', accountName: 'Revenue' }), false);
  });

  await t.test('Dashboard Revenue matches canonical Profit/Loss Revenue', async () => {
    let profitLossCalls = 0;
    
    // Create a mock Prisma client structure matching the required shape
    const mockPrisma = {
      order: {
        aggregate: async () => ({ _sum: { grandTotal: 0 } }),
        findMany: async () => ([]),
      },
      journalEntry: {
        aggregate: async () => ({ _sum: { totalDebit: 0 } }),
        findMany: async () => ([]),
      },
      cashTransaction: {
        aggregate: async () => ({ _sum: { amount: 0 } }),
        findMany: async () => ([]),
      },
      inventory: {
        findMany: async () => ([]),
      },
      productionOrder: {
        count: async () => 0,
      },
      productionResult: {
        findMany: async () => ([]),
      },
      contentPlanner: {
        findMany: async () => ([]),
      },
      chartOfAccount: {
        findMany: async () => {
          profitLossCalls++;
          return [
            { id: 'acc1', accountType: 'Revenue', accountCode: '4000', accountName: 'Sales' },
            { id: 'acc2', accountType: 'Expense', accountCode: '5000', accountName: 'COGS' }
          ];
        }
      },
      journalEntryLine: {
        findMany: async () => {
          return [
            { chartOfAccountId: 'acc1', debitAmount: 0, creditAmount: 3167755 },
            { chartOfAccountId: 'acc2', debitAmount: 500000, creditAmount: 0 }
          ];
        }
      }
    };

    const dashboardService = new DashboardService({
      prismaClient: mockPrisma,
      cashFlow: { buildReport: async () => ({ closingCashPosition: 1000 }) },
      inventoryValuation: { buildReport: async () => ({ totalInventoryValue: 500 }) },
      nowFactory: () => new Date('2026-09-05T12:00:00.000Z')
    });

    const summary = await dashboardService.getExecutiveDashboardSummary({ range: 'thisMonth' });
    
    assert.equal(summary.kpis.totalRevenue, 3167755);
    assert.equal(summary.kpis.cogsThisMonth, 500000);
    assert.equal(summary.kpis.grossProfit, 3167755 - 500000);
    
    // Verify profitLoss calculation was called
    assert.ok(profitLossCalls >= 3); // Current month, previous month, total period
  });
});
