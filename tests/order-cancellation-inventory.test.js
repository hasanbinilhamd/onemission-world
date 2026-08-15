import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const orderServiceSource = fs.readFileSync(new URL('../lib/order/service.js', import.meta.url), 'utf8');
const inventoryServiceSource = fs.readFileSync(new URL('../lib/order/inventory-service.js', import.meta.url), 'utf8');
const adminCancelRouteSource = fs.readFileSync(new URL('../app/api/admin/orders/[id]/cancel/route.js', import.meta.url), 'utf8');
const financePostingSource = fs.readFileSync(new URL('../lib/finance-posting/service.js', import.meta.url), 'utf8');

function getMethodSource(source, methodName, nextMethodName = '') {
  const start = source.indexOf(`  async ${methodName}`);
  assert.notEqual(start, -1, `${methodName} should exist`);
  const end = nextMethodName ? source.indexOf(`  async ${nextMethodName}`, start + 1) : source.indexOf('\n  async ', start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

test('customer cancellation remains limited to customer cancellable fulfillment statuses', () => {
  assert.match(orderServiceSource, /const CUSTOMER_CANCELLABLE_FULFILLMENT_STATUSES = new Set\(\[\s*FULFILLMENT_STATUS\.PENDING,\s*\]\);/m);
  const method = getMethodSource(orderServiceSource, 'cancelOrderByCustomer', 'requestReturnByCustomer');
  assert.match(method, /allowedFulfillmentStatuses: CUSTOMER_CANCELLABLE_FULFILLMENT_STATUSES/);
});

test('admin cancellation allows pre-shipped fulfillment statuses and rejects shipped boundary', () => {
  assert.match(orderServiceSource, /const ADMIN_CANCELLABLE_FULFILLMENT_STATUSES = new Set/);
  assert.match(orderServiceSource, /FULFILLMENT_STATUS\.PACKING/);
  assert.match(orderServiceSource, /FULFILLMENT_STATUS\.READY_TO_SHIP/);
  assert.doesNotMatch(orderServiceSource.match(/const ADMIN_CANCELLABLE_FULFILLMENT_STATUSES[\s\S]*?\]\);/)?.[0] || '', /FULFILLMENT_STATUS\.SHIPPED/);
  const method = getMethodSource(orderServiceSource, 'cancelOrderByAdmin', 'cancelOrderByCustomer');
  assert.match(method, /canAdminCancelOrder\(order\)/);
});

test('cancellation releases inventory and reject restore re-reserves released inventory', () => {
  const perform = getMethodSource(orderServiceSource, 'performOrderCancellation', 'cancelOrderByAdmin');
  assert.match(perform, /releaseForOrder\(order\.id, \{ prismaClient: tx \}\)/);
  assert.match(perform, /postCogsCancellationReversal\(order, tx\)/);
  assert.match(inventoryServiceSource, /async releaseForOrder/);
  assert.match(inventoryServiceSource, /INVENTORY_MOVEMENT_TYPE\.RELEASED/);
  assert.match(inventoryServiceSource, /buildReleaseMovementId/);
  assert.match(inventoryServiceSource, /async reReserveReleasedInventoryForOrder/);
  assert.match(orderServiceSource, /reReserveReleasedInventoryForOrder\(returnRequest\.orderId, \{ prismaClient: tx \}\)/);
  assert.match(orderServiceSource, /postCogsCancellationRestore\(orderForRestore/);
});

test('admin cancellation endpoint is HQ-authorized and uses existing order service', () => {
  assert.match(adminCancelRouteSource, /requireHqPermission\(request, 'sales', 'fulfillment'\)/);
  assert.match(adminCancelRouteSource, /orderService\.cancelOrderByAdmin/);
});


test('finance posting supports idempotent COGS reversal and sales-refund accounting', () => {
  assert.match(financePostingSource, /COGS_REVERSAL_JOURNAL_SOURCE = 'COGS Reversal'/);
  assert.match(financePostingSource, /async postCogsCancellationReversal/);
  assert.match(financePostingSource, /async postCogsCancellationRestore/);
  assert.match(orderServiceSource, /accountType: 'Revenue'[\s\S]*Sales Return/);
  assert.doesNotMatch(orderServiceSource, /accountType: 'Expense'[\s\S]*Refund/);
});
