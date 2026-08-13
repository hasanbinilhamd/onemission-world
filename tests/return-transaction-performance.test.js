import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const orderServiceSource = fs.readFileSync(new URL('../lib/order/service.js', import.meta.url), 'utf8');
const financePostingSource = fs.readFileSync(new URL('../lib/finance-posting/service.js', import.meta.url), 'utf8');

function getMethodSource(source, methodName, nextMethodName) {
  const start = source.indexOf(`  async ${methodName}`);
  assert.notEqual(start, -1, `${methodName} should exist`);
  const end = source.indexOf(`  async ${nextMethodName}`, start + 1);
  assert.notEqual(end, -1, `${nextMethodName} should exist after ${methodName}`);
  return source.slice(start, end);
}

test('customer return request uses minimal validation query and response query outside transaction', () => {
  const method = getMethodSource(orderServiceSource, 'requestReturnByCustomer', 'sendRefundToGateway');

  assert.match(method, /getOrderRecordForReturnRequest\(orderId\)/);
  assert.match(orderServiceSource, /include: RETURN_REQUEST_ORDER_INCLUDE/);
  assert.match(method, /CRITICAL_TRANSACTION_OPTIONS/);
  assert.match(method, /responseOrder = await this\.prisma\.order\.findUnique/);
  assert.doesNotMatch(method, /return tx\.order\.findUnique/);
});

test('customer replacement return batches product and variant reads before transaction', () => {
  const method = getMethodSource(orderServiceSource, 'requestReturnByCustomer', 'sendRefundToGateway');
  const transactionIndex = method.indexOf('await this.prisma.$transaction');
  const batchIndex = method.indexOf('const [replacementProducts, replacementVariants] = await Promise.all');

  assert.ok(batchIndex > -1, 'replacement reads should be batched with Promise.all');
  assert.ok(batchIndex < transactionIndex, 'replacement reads should happen before transaction');
  assert.match(method, /this\.prisma\.product\.findMany/);
  assert.match(method, /this\.prisma\.inventory\.findMany/);
});

test('manual refund paid resolves finance master data before transaction', () => {
  const method = getMethodSource(orderServiceSource, 'markManualRefundPaid', 'markReplacementSent');
  const transactionIndex = method.indexOf('await this.prisma.$transaction');
  const financeResolveIndex = method.indexOf('const [cashAccount, refundExpense] = await Promise.all');
  const financialAccountIndex = method.indexOf('const financialAccount = await this.prisma.financialAccount.findFirst');
  const transactionBody = method.slice(transactionIndex);

  assert.ok(financeResolveIndex > -1 && financeResolveIndex < transactionIndex, 'cash/refund account lookup should happen before transaction');
  assert.ok(financialAccountIndex > -1 && financialAccountIndex < transactionIndex, 'financial account lookup should happen before transaction');
  assert.doesNotMatch(transactionBody, /resolveCashOrBankAccount\(tx\)/);
  assert.doesNotMatch(transactionBody, /resolveRefundExpenseAccount\(tx\)/);
  assert.doesNotMatch(transactionBody, /tx\.financialAccount\.findFirst/);
});

test('manual refund paid keeps idempotent lock and accounting mutations inside one transaction', () => {
  const method = getMethodSource(orderServiceSource, 'markManualRefundPaid', 'markReplacementSent');
  const transactionIndex = method.indexOf('await this.prisma.$transaction');
  const transactionBody = method.slice(transactionIndex);

  const lockIndex = transactionBody.indexOf('tx.returnRequest.updateMany');
  const cashIndex = transactionBody.indexOf('tx.cashTransaction.create');
  const journalIndex = transactionBody.indexOf('tx.journalEntry.create');
  const returnUpdateIndex = transactionBody.indexOf('await tx.returnRequest.update({');
  const timelineIndex = transactionBody.indexOf('tx.orderTimeline.create');

  assert.ok(lockIndex > -1, 'refund lock should stay inside transaction');
  assert.ok(lockIndex < cashIndex, 'lock should happen before cash transaction');
  assert.ok(cashIndex < journalIndex, 'cash transaction should happen before journal');
  assert.ok(journalIndex < returnUpdateIndex, 'journal should happen before return completion');
  assert.ok(returnUpdateIndex < timelineIndex, 'return completion should happen before timeline');
  assert.match(method, /CRITICAL_TRANSACTION_OPTIONS/);
});

test('journal number generation no longer scans all monthly journals', () => {
  const method = getMethodSource(financePostingSource, 'generateJournalNumber', 'findExistingSalesJournal');

  assert.match(method, /journalEntry\.findFirst/);
  assert.doesNotMatch(method, /journalEntry\.findMany/);
});
