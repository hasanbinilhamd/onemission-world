import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const orders = await prisma.order.findMany({
    include: { paymentAttempt: true }
  });
  console.log('Orders:', orders.map(o => ({
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    status: o.status,
    paymentStatus: o.paymentAttempt?.status,
    grandTotal: o.grandTotal
  })));

  const journals = await prisma.journalEntry.findMany({
    include: { lines: true }
  });
  console.log('Journals:', journals.map(j => ({
    journalNumber: j.journalNumber,
    date: j.journalDate,
    source: j.journalSource,
    sourceId: j.sourceId,
    totalDebit: j.totalDebit,
    totalCredit: j.totalCredit,
    lines: j.lines.map(l => ({ accountId: l.chartOfAccountId, debit: l.debitAmount, credit: l.creditAmount }))
  })));
  
  const accounts = await prisma.chartOfAccount.findMany();
  console.log('Accounts:', accounts.filter(a => a.accountType === 'Revenue').map(a => ({ id: a.id, name: a.accountName })));
}

run();