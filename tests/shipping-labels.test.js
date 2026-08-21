import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const labelPdfSource = fs.readFileSync(new URL('../lib/shipping/label-pdf.js', import.meta.url), 'utf8');
const singleRouteSource = fs.readFileSync(new URL('../app/api/orders/[id]/shipping-label/route.js', import.meta.url), 'utf8');
const bulkRouteSource = fs.readFileSync(new URL('../app/api/orders/shipping-labels/route.js', import.meta.url), 'utf8');
const ordersModuleSource = fs.readFileSync(new URL('../components/onemission/orders-module.jsx', import.meta.url), 'utf8');

test('shipping label PDF uses 80x100mm thermal format with barcode default', () => {
  assert.match(labelPdfSource, /const LABEL_WIDTH = 80 \* MM_TO_PT/);
  assert.match(labelPdfSource, /const LABEL_HEIGHT = 100 \* MM_TO_PT/);
  assert.match(labelPdfSource, /drawCode128\(doc, trackingNumber/);
  assert.match(labelPdfSource, /format = 'barcode'/);
  assert.match(singleRouteSource, /X-Label-Format/);
});

test('shipping label PDF uses OneMission and courier logo assets', () => {
  assert.match(labelPdfSource, /onemission-logo\.png/);
  assert.match(labelPdfSource, /jne-logo\.png/);
  assert.match(labelPdfSource, /jnt-logo\.png/);
  assert.match(labelPdfSource, /lion-parcel-logo\.png/);
});

test('shipping label eligibility requires Biteship shipment and AWB', () => {
  assert.match(labelPdfSource, /normalizedProvider === 'biteship'/);
  assert.match(labelPdfSource, /shippingProviderOrderId/);
  assert.match(labelPdfSource, /trackingNumber/);
  assert.match(labelPdfSource, /CANCELLED/);
});

test('shipping label endpoints are fulfillment-protected and return PDFs', () => {
  assert.match(singleRouteSource, /requireHqPermission\(request, 'sales', 'fulfillment'\)/);
  assert.match(singleRouteSource, /buildShippingLabelsPdfBuffer\(\[order\]/);
  assert.match(singleRouteSource, /Content-Type': 'application\/pdf'/);
  assert.match(bulkRouteSource, /requireHqPermission\(request, 'sales', 'fulfillment'\)/);
  assert.match(bulkRouteSource, /buildShippingLabelsPdfBuffer\(printable/);
  assert.match(bulkRouteSource, /X-Printable-Count/);
});

test('orders UI exposes single and bulk shipping label print actions', () => {
  assert.match(ordersModuleSource, /printShippingLabel\(orderId\)/);
  assert.match(ordersModuleSource, /printShippingLabels\(orderIds\)/);
  assert.match(ordersModuleSource, /Print Shipping Label/);
  assert.match(ordersModuleSource, /Print Shipping Labels/);
});
