import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assertValidScanModeShipment,
  buildScanModeReadyOrder,
  normalizeScanTrackingNumber,
  resolveScanModeShipmentConfig,
} from '../lib/order/scan-mode.js';

const scanRouteSource = fs.readFileSync(new URL('../app/api/orders/scan-mode/route.js', import.meta.url), 'utf8');
const ordersModuleSource = fs.readFileSync(new URL('../components/onemission/orders-module.jsx', import.meta.url), 'utf8');
const scanModeUiSource = ordersModuleSource.slice(ordersModuleSource.indexOf('function ScanModeDialog'), ordersModuleSource.indexOf('export function OrdersModule'));

function createOrder(overrides = {}) {
  return {
    id: 'order-1',
    orderNumber: 'ORD-202608-00001',
    publicOrderNumber: 'OM-NNEY-XXXX',
    customerName: 'Dian Israr',
    status: 'PROCESSING',
    fulfillmentStatus: 'READY_TO_SHIP',
    courier: 'JNT',
    courierService: 'EZ',
    shipmentCourier: 'J&T Express',
    shipmentService: 'EZ',
    trackingNumber: '',
    shippingDate: null,
    shippingCost: 18000,
    actualShippingCost: null,
    _count: { items: 2 },
    ...overrides,
  };
}

function assertScanRejected({ order, trackingNumber = 'JD0681953291', duplicateOrder = null, code }) {
  assert.throws(
    () => assertValidScanModeShipment({ order, trackingNumber, duplicateOrder }),
    (error) => error.code === code,
  );
}

test('normalizes scan tracking numbers consistently', () => {
  assert.equal(normalizeScanTrackingNumber(' jd 0681953291 '), 'JD0681953291');
  assert.equal(normalizeScanTrackingNumber('\nJd\t068\r'), 'JD068');
});

test('accepts READY_TO_SHIP scan shipment and resolves shipment information from the order', () => {
  const order = createOrder({ actualShippingCost: 32800 });
  const validation = assertValidScanModeShipment({ order, trackingNumber: ' jd0681953291 ' });

  assert.equal(validation.trackingNumber, 'JD0681953291');
  assert.equal(validation.fulfillmentStatus, 'READY_TO_SHIP');
  assert.equal(validation.shipmentCourier, 'J&T Express');
  assert.equal(validation.shipmentService, 'EZ');

  const config = resolveScanModeShipmentConfig(createOrder({ shipmentCourier: '', shipmentService: '' }));
  assert.equal(config.shipmentCourier, 'JNT');
  assert.equal(config.shipmentService, 'EZ');

  const readyOrder = buildScanModeReadyOrder(order);
  assert.equal(readyOrder.customerShippingCost, 18000);
  assert.equal(readyOrder.actualShippingCost, 32800);
  assert.equal(readyOrder.totalItems, 2);
});

test('rejects wrong status before Scan Mode shipment', () => {
  assertScanRejected({
    order: createOrder({ fulfillmentStatus: 'PACKING' }),
    code: 'ORDER_SCAN_NOT_READY_TO_SHIP',
  });
});

test('rejects duplicate tracking number assigned to another order', () => {
  assertScanRejected({
    order: createOrder(),
    duplicateOrder: createOrder({ id: 'order-2', publicOrderNumber: 'OM-DUPE-0001', trackingNumber: 'JD0681953291' }),
    code: 'ORDER_SCAN_TRACKING_DUPLICATE',
  });
});

test('rejects cancelled and already shipped orders', () => {
  assertScanRejected({
    order: createOrder({ status: 'CANCELLED', fulfillmentStatus: 'CANCELLED' }),
    code: 'ORDER_SCAN_CANCELLED',
  });
  assertScanRejected({
    order: createOrder({ status: 'SHIPPED', fulfillmentStatus: 'SHIPPED' }),
    code: 'ORDER_SHIPMENT_LOCKED',
  });
});

test('rejects missing tracking and selected-order tracking reuse for idempotency', () => {
  assertScanRejected({
    order: createOrder(),
    trackingNumber: '   ',
    code: 'ORDER_SCAN_TRACKING_REQUIRED',
  });
  assertScanRejected({
    order: createOrder({ trackingNumber: 'JD0681953291' }),
    trackingNumber: 'JD0681953291',
    code: 'ORDER_SCAN_TRACKING_ALREADY_ASSIGNED',
  });
});

test('Scan Mode endpoint uses existing fulfillment service, permission, audit, and shipment fields', () => {
  assert.match(scanRouteSource, /requireHqPermission\(request, 'sales', 'fulfillment'\)/);
  assert.match(scanRouteSource, /orderService\.updateFulfillmentStatus\(\{/);
  assert.match(scanRouteSource, /fulfillmentStatus: FULFILLMENT_STATUS\.SHIPPED/);
  assert.match(scanRouteSource, /trackingNumber: validation\.trackingNumber/);
  assert.match(scanRouteSource, /shipmentCourier: validation\.shipmentCourier/);
  assert.match(scanRouteSource, /shipmentService: validation\.shipmentService/);
  assert.match(scanRouteSource, /shippingDate: normalizeShippingDateInput\(payload\.shippingDate\)/);
  assert.match(scanRouteSource, /actualShippingCost: payload\.actualShippingCost/);
  assert.match(scanRouteSource, /SCAN_MODE_AUDIT_ACTION/);
  assert.match(scanRouteSource, /source: SCAN_MODE_SOURCE/);
});

test('Scan Mode UI keeps existing camera workflow and manual fallback', () => {
  assert.match(ordersModuleSource, /@zxing\/browser/);
  assert.match(ordersModuleSource, /facingMode: \{ ideal: 'environment' \}/);
  assert.match(ordersModuleSource, /Scan with Camera/);
  assert.match(ordersModuleSource, /Start Camera/);
  assert.match(ordersModuleSource, /Enter Tracking Manually/);
  assert.match(ordersModuleSource, /Update Tracking Information/);
  assert.match(ordersModuleSource, /Import Tracking Numbers/);
  assert.match(ordersModuleSource, /Scan Mode/);
});

test('Scan Mode image scanner is wired as client-side input only', () => {
  assert.match(ordersModuleSource, /type=\"file\" accept=\"image\/\*\"/);
  assert.match(ordersModuleSource, /Upload \/ Take Photo/);
  assert.match(ordersModuleSource, /decodeBarcodeFromScanModeImage/);
  assert.match(ordersModuleSource, /decodeFromImageElement/);
  assert.match(ordersModuleSource, /Selected Label/);
  assert.match(ordersModuleSource, /URL\.createObjectURL\(file\)/);
  assert.doesNotMatch(scanModeUiSource, /FormData\(\)/);
});

test('image decode success normalizes tracking and reuses existing confirmation flow', () => {
  assert.match(ordersModuleSource, /const decodedTrackingNumber = normalizeScannedTrackingNumber\(imageDecodeResult\.trackingNumber\)/);
  assert.match(ordersModuleSource, /setScanResult\(decodedTrackingNumber\)/);
  assert.match(ordersModuleSource, /confirmScanModeShipment/);
  assert.match(ordersModuleSource, /fetch\('\/api\/orders\/scan-mode'/);
});

test('image decode failure and ambiguous images do not submit shipments', () => {
  assert.match(ordersModuleSource, /Barcode not detected/);
  assert.match(ordersModuleSource, /Multiple barcodes detected/);
  assert.match(ordersModuleSource, /Please upload a photo containing only the courier label barcode/);
  assert.match(ordersModuleSource, /Try Another Image/);
  assert.match(ordersModuleSource, /Scan with Camera/);
  assert.match(ordersModuleSource, /Enter Tracking Manually/);
  assert.doesNotMatch(scanModeUiSource, /imageDecodeResult[\s\S]{0,200}confirmShipment\(\)/);
});
