import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const orderServiceSource = fs.readFileSync(new URL('../lib/order/service.js', import.meta.url), 'utf8');
const templateRouteSource = fs.readFileSync(new URL('../app/api/orders/tracking-template/route.js', import.meta.url), 'utf8');
const previewRouteSource = fs.readFileSync(new URL('../app/api/orders/tracking-import/preview/route.js', import.meta.url), 'utf8');
const confirmRouteSource = fs.readFileSync(new URL('../app/api/orders/tracking-import/confirm/route.js', import.meta.url), 'utf8');
const bulkRouteSource = fs.readFileSync(new URL('../app/api/orders/bulk-fulfillment/route.js', import.meta.url), 'utf8');
const ordersModuleSource = fs.readFileSync(new URL('../components/onemission/orders-module.jsx', import.meta.url), 'utf8');

test('tracking template includes date-time and actual shipping cost columns', () => {
  assert.match(templateRouteSource, /'Shipping Date & Time'/);
  assert.match(templateRouteSource, /'Actual Shipping Cost'/);
  assert.match(templateRouteSource, /DD-MM-YYYY HH:mm/);
  assert.match(templateRouteSource, /actualShippingCost: true/);
});

test('tracking import validates DD-MM-YYYY HH:mm and actual shipping cost', () => {
  assert.match(previewRouteSource, /Shipping Date & Time/);
  assert.match(previewRouteSource, /dayFirstDateTime/);
  assert.match(previewRouteSource, /HH:mm/);
  assert.match(previewRouteSource, /Actual Shipping Cost/);
  assert.match(previewRouteSource, /greater than or equal to 0/);
});

test('manual and bulk tracking pass actual shipping cost to fulfillment service', () => {
  assert.match(orderServiceSource, /actualShippingCost = undefined/);
  assert.match(orderServiceSource, /ORDER_ACTUAL_SHIPPING_COST_INVALID/);
  assert.match(confirmRouteSource, /actualShippingCost: row\.actualShippingCost/);
  assert.match(bulkRouteSource, /actualShippingCost: entry\.actualShippingCost/);
  assert.match(ordersModuleSource, /Actual Shipping Cost/);
});
