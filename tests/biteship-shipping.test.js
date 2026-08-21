import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mapBiteshipStatusToFulfillmentStatus, normalizeBiteshipOrderResponse } from '../lib/shipping/biteship/service.js';

const schemaSource = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const createRouteSource = fs.readFileSync(new URL('../app/api/orders/[id]/biteship-shipment/route.js', import.meta.url), 'utf8');
const webhookRouteSource = fs.readFileSync(new URL('../app/api/webhooks/biteship/route.js', import.meta.url), 'utf8');
const orderServiceSource = fs.readFileSync(new URL('../lib/order/service.js', import.meta.url), 'utf8');
const biteshipClientSource = fs.readFileSync(new URL('../lib/shipping/biteship/client.js', import.meta.url), 'utf8');
const biteshipConfigSource = fs.readFileSync(new URL('../lib/shipping/biteship/config.js', import.meta.url), 'utf8');
const biteshipServiceSource = fs.readFileSync(new URL('../lib/shipping/biteship/service.js', import.meta.url), 'utf8');
const biteshipProviderSource = fs.readFileSync(new URL('../lib/shipping/providers/biteship-provider.js', import.meta.url), 'utf8');
const shippingIndexSource = fs.readFileSync(new URL('../lib/shipping/index.js', import.meta.url), 'utf8');
const checkoutServiceSource = fs.readFileSync(new URL('../lib/checkout/service.js', import.meta.url), 'utf8');
const ordersModuleSource = fs.readFileSync(new URL('../components/onemission/orders-module.jsx', import.meta.url), 'utf8');
const envExampleSource = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

test('schema persists Biteship shipment identifiers without replacing existing shipment fields', () => {
  assert.match(schemaSource, /shippingProvider\s+String\s+@default\("manual"\)/);
  assert.match(schemaSource, /shippingOriginId\s+String\s+@default\(""\)/);
  assert.match(schemaSource, /shippingDestinationId\s+String\s+@default\(""\)/);
  assert.match(schemaSource, /shippingProviderOrderId\s+String\s+@default\(""\)/);
  assert.match(schemaSource, /shippingProviderTrackingId\s+String\s+@default\(""\)/);
  assert.match(schemaSource, /shippingLabelUrl\s+String\s+@default\(""\)/);
  assert.match(schemaSource, /trackingNumber\s+String\s+@default\(""\)/);
  assert.match(schemaSource, /actualShippingCost\s+Float\?/);
  assert.match(schemaSource, /shippingCost\s+Float\s+@default\(0\)/);
});

test('Biteship client centralizes API configuration and authentication', () => {
  assert.match(biteshipConfigSource, /BITESHIP_SANDBOX_API_KEY/);
  assert.match(biteshipClientSource, /Authorization: this\.config\.apiKey/);
  assert.match(biteshipClientSource, /createOrder\(payload\)/);
  assert.match(biteshipClientSource, /retrieveRates\(payload\)/);
  assert.match(biteshipClientSource, /cancelOrder\(orderId\)/);
  assert.match(biteshipClientSource, /BITESHIP_TIMEOUT/);
  assert.doesNotMatch(biteshipClientSource, /biteship_live\.[A-Za-z0-9]/);
  assert.doesNotMatch(biteshipClientSource, /biteship_test\.[A-Za-z0-9]/);
});


test('Biteship can be selected as checkout shipping rates provider without removing RajaOngkir', () => {
  assert.match(shippingIndexSource, /shippingConfig\.provider === 'biteship'/);
  assert.match(shippingIndexSource, /new BiteshipProvider\(\)/);
  assert.match(shippingIndexSource, /new RajaOngkirProvider\(\)/);
  assert.match(biteshipProviderSource, /retrieveRates\(payload\)/);
  assert.match(biteshipProviderSource, /origin_postal_code/);
  assert.match(biteshipProviderSource, /destination_postal_code/);
  assert.match(biteshipProviderSource, /SHIPPING_BITESHIP_DESTINATION_POSTAL_INVALID/);
  assert.match(biteshipProviderSource, /courier_service_code/);
  assert.match(biteshipProviderSource, /shippingProvider: 'biteship'/);
});

test('checkout stores shipping provider context for new orders', () => {
  assert.match(checkoutServiceSource, /destinationPostalCode: postalCode/);
  assert.match(checkoutServiceSource, /shippingProvider: String\(selectedRate\.shippingProvider/);
  assert.match(checkoutServiceSource, /shippingOriginId: String\(selectedRate\.originProviderId/);
  assert.match(checkoutServiceSource, /shippingDestinationId: String\(selectedRate\.destinationProviderId/);
});

test('create shipment route is admin-only, calls Biteship, then transitions to Ready To Ship', () => {
  assert.match(createRouteSource, /requireHqPermission\(request, 'sales', 'fulfillment'\)/);
  assert.match(createRouteSource, /biteshipShipmentService\.createShipment\(\{/);
  assert.match(createRouteSource, /orderService\.updateFulfillmentStatus\(\{/);
  assert.match(createRouteSource, /fulfillmentStatus: FULFILLMENT_STATUS\.READY_TO_SHIP/);
  assert.match(createRouteSource, /BITESHIP_SHIPMENT_CREATED/);
  assert.match(createRouteSource, /error instanceof BiteshipApiError/);
  assert.match(createRouteSource, /provider: 'BITESHIP'/);
});

test('Biteship service enforces Packing-only creation and duplicate protection', () => {
  assert.match(biteshipServiceSource, /fulfillmentStatus !== FULFILLMENT_STATUS\.PACKING/);
  assert.match(biteshipServiceSource, /shippingProviderOrderId: ''/);
  assert.match(biteshipServiceSource, /shippingProviderOrderId: `creating-\$\{order\.id\}`/);
  assert.match(biteshipServiceSource, /reference_id: order\.id/);
  assert.match(biteshipServiceSource, /BITESHIP_SHIPMENT_ALREADY_EXISTS/);
  assert.match(biteshipServiceSource, /BITESHIP_SHIPMENT_LOCKED/);
});

test('normalizes Biteship order response into OneMission shipment fields', () => {
  const normalized = normalizeBiteshipOrderResponse({
    id: 'bship-order-1',
    status: 'confirmed',
    price: 32800,
    label_url: 'https://label.example/1.pdf',
    courier: {
      tracking_id: 'track-1',
      waybill_id: 'JNT123',
      company: 'jnt',
      type: 'ez',
      shipment_fee: 32000,
    },
  });

  assert.equal(normalized.providerOrderId, 'bship-order-1');
  assert.equal(normalized.providerTrackingId, 'track-1');
  assert.equal(normalized.waybillId, 'JNT123');
  assert.equal(normalized.courierCompany, 'jnt');
  assert.equal(normalized.courierType, 'ez');
  assert.equal(normalized.actualShippingCost, 32000);
  assert.equal(normalized.labelUrl, 'https://label.example/1.pdf');
});

test('webhook maps shipment progress to existing fulfillment statuses', () => {
  assert.equal(mapBiteshipStatusToFulfillmentStatus('confirmed'), 'READY_TO_SHIP');
  assert.equal(mapBiteshipStatusToFulfillmentStatus('allocated'), 'READY_TO_SHIP');
  assert.equal(mapBiteshipStatusToFulfillmentStatus('picked'), 'SHIPPED');
  assert.equal(mapBiteshipStatusToFulfillmentStatus('in_transit'), 'SHIPPED');
  assert.equal(mapBiteshipStatusToFulfillmentStatus('delivered'), 'DELIVERED');
  assert.equal(mapBiteshipStatusToFulfillmentStatus('cancelled'), null);
});

test('webhook endpoint verifies a secret and uses existing fulfillment service', () => {
  assert.match(biteshipConfigSource, /BITESHIP_WEBHOOK_SECRET/);
  assert.match(webhookRouteSource, /x-biteship-webhook-secret/);
  assert.match(webhookRouteSource, /isEmptyWebhookValidationPayload/);
  assert.match(webhookRouteSource, /validation: true/);
  assert.match(webhookRouteSource, /biteshipShipmentService\.updateFromWebhook/);
  assert.match(webhookRouteSource, /orderService\.updateFulfillmentStatus/);
  assert.match(webhookRouteSource, /FULFILLMENT_STATUS\.SHIPPED/);
  assert.match(webhookRouteSource, /FULFILLMENT_STATUS\.DELIVERED/);
});

test('admin cancellation checks Biteship before local cancellation workflow', () => {
  const methodStart = orderServiceSource.indexOf('async cancelOrderByAdmin');
  const methodSource = orderServiceSource.slice(methodStart, orderServiceSource.indexOf('async cancelOrderByCustomer', methodStart));
  assert.match(methodSource, /biteshipShipmentService\.cancelShipmentForOrder\(order/);
  assert.ok(methodSource.indexOf('biteshipShipmentService.cancelShipmentForOrder') < methodSource.indexOf('this.performOrderCancellation'));
});

test('HQ UI exposes create shipment and label actions without removing manual fulfillment', () => {
  assert.match(ordersModuleSource, /Create Biteship Shipment/);
  assert.match(ordersModuleSource, /View \/ Print Label/);
  assert.match(ordersModuleSource, /Save Fulfillment Update/);
  assert.match(ordersModuleSource, /Update Tracking Information/);
  assert.match(ordersModuleSource, /Scan Mode/);
});

test('Biteship env variables are documented', () => {
  assert.match(envExampleSource, /BITESHIP_MODE="sandbox"/);
  assert.match(envExampleSource, /BITESHIP_SANDBOX_API_KEY/);
  assert.match(envExampleSource, /BITESHIP_PRODUCTION_API_KEY/);
  assert.match(envExampleSource, /BITESHIP_ORIGIN_CONTACT_NAME/);
  assert.match(envExampleSource, /BITESHIP_COURIER_SERVICE_MAP_JSON/);
});
