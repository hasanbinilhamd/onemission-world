import { prisma } from '@/lib/prisma';

export function isCogsAccount(account) {
  const accountCode = String(account?.accountCode || '').trim();
  const accountName = String(account?.accountName || '').trim().toLowerCase();
  return accountCode === '5000' || accountName.includes('cost of goods sold') || accountName.includes('cogs');
}

export async function calculateProfitLossForPeriod({ periodStart, periodEnd, prismaClient = prisma }) {
  const journalFilter = { AND: [{ status: 'Posted' }] };
  if (periodStart) journalFilter.AND.push({ journalDate: { gte: periodStart } });
  if (periodEnd) journalFilter.AND.push({ journalDate: { lte: periodEnd } });

  const accounts = await prismaClient.chartOfAccount.findMany({
    where: {
      isActive: true,
      allowTransaction: true,
      accountType: { in: ['Revenue', 'Expense'] },
    },
    orderBy: { accountCode: 'asc' },
  });

  if (!accounts.length) {
    return { totalRevenue: 0, totalCogs: 0, grossProfit: 0, totalOperatingExpenses: 0, totalExpenses: 0, netProfit: 0 };
  }

  const lines = await prismaClient.journalEntryLine.findMany({
    where: {
      journalEntry: journalFilter,
      chartOfAccountId: { in: accounts.map((account) => account.id) },
    },
    select: { chartOfAccountId: true, debitAmount: true, creditAmount: true },
  });

  const aggMap = {};
  for (const line of lines) {
    if (!aggMap[line.chartOfAccountId]) aggMap[line.chartOfAccountId] = { totalDebit: 0, totalCredit: 0 };
    aggMap[line.chartOfAccountId].totalDebit += Number(line.debitAmount || 0);
    aggMap[line.chartOfAccountId].totalCredit += Number(line.creditAmount || 0);
  }

  let totalRevenue = 0;
  let totalCogs = 0;
  let totalOperatingExpenses = 0;
  for (const account of accounts) {
    const agg = aggMap[account.id];
    if (!agg) continue;
    const amount = account.accountType === 'Revenue'
      ? agg.totalCredit - agg.totalDebit
      : agg.totalDebit - agg.totalCredit;
    if (account.accountType === 'Revenue') totalRevenue += amount;
    else if (isCogsAccount(account)) totalCogs += amount;
    else totalOperatingExpenses += amount;
  }

  const grossProfit = totalRevenue - totalCogs;
  const totalExpenses = totalCogs + totalOperatingExpenses;
  const netProfit = grossProfit - totalOperatingExpenses;
  return { totalRevenue, totalCogs, grossProfit, totalOperatingExpenses, totalExpenses, netProfit };
}
