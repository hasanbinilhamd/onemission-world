import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const paymentAttemptSource = fs.readFileSync(new URL('../lib/payment-attempt/service.js', import.meta.url), 'utf8');
const orderServiceSource = fs.readFileSync(new URL('../lib/order/service.js', import.meta.url), 'utf8');
const recoveryRouteSource = fs.readFileSync(new URL('../app/api/admin/orders/[id]/recover-payment-side-effects/route.js', import.meta.url), 'utf8');

function getExistingOrderBranchSource(source) {
  const start = source.indexOf('if (existingOrder) {');
  assert.notEqual(start, -1, 'existing order branch should exist');
  const end = source.indexOf('} else {', start);
  assert.notEqual(end, -1, 'existing order branch should have an else branch');
  return source.slice(start, end);
}

test('paid webhook retries recover downstream order side effects for existing orders', () => {
  const branch = getExistingOrderBranchSource(paymentAttemptSource);

  assert.match(branch, /const recoveredOrder = await this\.onPaymentConfirmed\(workingAttempt\);/);
  assert.match(branch, /recoveryInventoryReservationResult/);
  assert.match(branch, /REUSED_AND_RECOVERED/);
});

test('order recovery remains idempotent through existing order service side-effect guards', () => {
  assert.match(orderServiceSource, /async createFromCheckoutSession\(\{ paymentAttemptId \}\)/);
  assert.match(orderServiceSource, /let existingOrder = await this\.getExistingOrderForPaymentAttempt\(paymentAttempt\);/);
  assert.match(orderServiceSource, /this\.inventoryReservationService\.reserveForOrder\(orderId\)/);
  assert.match(orderServiceSource, /await this\.postSalesJournalIfNeeded\(existingOrder\)/);
  assert.match(orderServiceSource, /await this\.postCogsJournalIfNeeded\(existingOrder\)/);
  assert.ok(
    orderServiceSource.indexOf('await this.postSalesJournalIfNeeded(existingOrder)') < orderServiceSource.indexOf('this.inventoryReservationService.reserveForOrder(orderId)'),
    'sales journal should be posted before inventory reservation so paid revenue is not lost when inventory recovery fails',
  );
  assert.match(orderServiceSource, /return attachInternalOrderMetadata\(this\.buildOrderResponse\(existingOrder\), \{/);
});

test('manual recovery endpoint is protected and uses existing order service flow', () => {
  assert.match(recoveryRouteSource, /requireHqPermission\(request, 'finance', 'cash_in'\)/);
  assert.match(recoveryRouteSource, /orderService\.createFromCheckoutSession\(\{/);
  assert.match(recoveryRouteSource, /paymentAttemptId: order\.paymentAttemptId/);
  assert.match(recoveryRouteSource, /ORDER_PAYMENT_SIDE_EFFECTS_RECOVERED/);
  assert.match(recoveryRouteSource, /ORDER_PAYMENT_SIDE_EFFECTS_PARTIALLY_RECOVERED/);
  assert.match(recoveryRouteSource, /if \(recoveryError && !after\.hasSalesJournal\)/);
  assert.match(recoveryRouteSource, /getRecoveryState\(order\.id\)/);
});
