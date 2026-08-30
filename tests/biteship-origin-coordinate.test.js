import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateOrderPayload, validateOriginConfig } from '../lib/shipping/biteship/service.js';
import { getBiteshipConfig } from '../lib/shipping/biteship/config.js';

/**
 * Biteship create-order payload — origin coordinate coverage.
 *
 * Lion pickup booking requires origin_coordinate. These tests cover:
 *   1. valid coordinates included in payload as numbers
 *   2. missing latitude fails with a clean configuration error
 *   3. missing longitude fails with a clean configuration error
 *   4. out-of-range latitude fails validation
 *   5. out-of-range longitude fails validation
 *   6. ENV parsing produces numbers (and null when unset)
 */

function buildOrigin(overrides = {}) {
  return {
    contactName: 'OneMission Warehouse',
    contactPhone: '081234567890',
    contactEmail: 'warehouse@onemission.id',
    organization: 'OneMission',
    address: 'Jl. Warehouse No. 1, Bandung',
    postalCode: '40123',
    latitude: -6.2253114,
    longitude: 106.7993735,
    ...overrides,
  };
}

function buildOrder(overrides = {}) {
  return {
    id: 'order-1',
    orderNumber: 'OM-1001',
    publicOrderNumber: 'OM-1001',
    recipientName: 'Budi',
    recipientPhone: '081298765432',
    customerEmail: 'budi@example.com',
    streetAddress: 'Jl. Penerima No. 2',
    districtName: 'Coblong',
    cityName: 'Bandung',
    provinceName: 'Jawa Barat',
    postalCode: '40132',
    items: [{ productName: 'Pro Sport Shirt', sku: 'SKU-1', price: 250000, quantity: 1 }],
    ...overrides,
  };
}

function buildConfig(originOverrides = {}) {
  return {
    origin: buildOrigin(originOverrides),
    defaultItemWeightGrams: 200,
    defaultItemLengthCm: 20,
    defaultItemWidthCm: 15,
    defaultItemHeightCm: 5,
  };
}

test('CASE 1 — valid coordinates are included in the create payload as numbers', () => {
  const payload = buildCreateOrderPayload({
    order: buildOrder(),
    courierCompany: 'lion',
    courierType: 'pickup',
    config: buildConfig(),
  });

  assert.deepEqual(payload.origin_coordinate, { latitude: -6.2253114, longitude: 106.7993735 });
  assert.equal(typeof payload.origin_coordinate.latitude, 'number');
  assert.equal(typeof payload.origin_coordinate.longitude, 'number');
  // Existing fields are preserved.
  assert.equal(payload.origin_contact_name, 'OneMission Warehouse');
  assert.equal(payload.destination_contact_name, 'Budi');
  assert.equal(payload.reference_id, 'order-1');
  assert.equal(payload.metadata.orderId, 'order-1');
  assert.equal(payload.items.length, 1);
});

test('CASE 2 — missing latitude fails with a clean configuration error', () => {
  assert.throws(
    () => buildCreateOrderPayload({
      order: buildOrder(),
      courierCompany: 'lion',
      courierType: 'pickup',
      config: buildConfig({ latitude: null }),
    }),
    (error) => error?.code === 'BITESHIP_ORIGIN_COORDINATE_CONFIG_INCOMPLETE'
      && /BITESHIP_ORIGIN_LATITUDE/.test(error?.message || ''),
  );
});

test('CASE 3 — missing longitude fails with a clean configuration error', () => {
  assert.throws(
    () => buildCreateOrderPayload({
      order: buildOrder(),
      courierCompany: 'lion',
      courierType: 'pickup',
      config: buildConfig({ longitude: null }),
    }),
    (error) => error?.code === 'BITESHIP_ORIGIN_COORDINATE_CONFIG_INCOMPLETE'
      && /BITESHIP_ORIGIN_LONGITUDE/.test(error?.message || ''),
  );
});

test('CASE 4 — invalid latitude fails validation', () => {
  assert.throws(
    () => validateOriginConfig(buildOrigin({ latitude: 120 })),
    (error) => error?.code === 'BITESHIP_ORIGIN_COORDINATE_CONFIG_INVALID'
      && /latitude/.test(error?.message || ''),
  );
});

test('CASE 5 — invalid longitude fails validation', () => {
  assert.throws(
    () => validateOriginConfig(buildOrigin({ longitude: 200 })),
    (error) => error?.code === 'BITESHIP_ORIGIN_COORDINATE_CONFIG_INVALID'
      && /longitude/.test(error?.message || ''),
  );
});

test('coordinates are never sent as null/undefined strings in the payload', () => {
  const payload = buildCreateOrderPayload({
    order: buildOrder(),
    courierCompany: 'lion',
    courierType: 'pickup',
    config: buildConfig(),
  });
  assert.notEqual(payload.origin_coordinate.latitude, null);
  assert.notEqual(payload.origin_coordinate.longitude, null);
});

test('ENV parsing — BITESHIP_ORIGIN_LATITUDE/LONGITUDE become numbers, unset becomes null', () => {
  const previousLatitude = process.env.BITESHIP_ORIGIN_LATITUDE;
  const previousLongitude = process.env.BITESHIP_ORIGIN_LONGITUDE;
  try {
    process.env.BITESHIP_ORIGIN_LATITUDE = '-6.2253114';
    process.env.BITESHIP_ORIGIN_LONGITUDE = '106.7993735';
    const configured = getBiteshipConfig();
    assert.equal(configured.origin.latitude, -6.2253114);
    assert.equal(configured.origin.longitude, 106.7993735);

    delete process.env.BITESHIP_ORIGIN_LATITUDE;
    delete process.env.BITESHIP_ORIGIN_LONGITUDE;
    const unset = getBiteshipConfig();
    assert.equal(unset.origin.latitude, null);
    assert.equal(unset.origin.longitude, null);
  } finally {
    if (previousLatitude === undefined) delete process.env.BITESHIP_ORIGIN_LATITUDE;
    else process.env.BITESHIP_ORIGIN_LATITUDE = previousLatitude;
    if (previousLongitude === undefined) delete process.env.BITESHIP_ORIGIN_LONGITUDE;
    else process.env.BITESHIP_ORIGIN_LONGITUDE = previousLongitude;
  }
});

test('absence of both coordinates keeps payload compatible (no origin_coordinate key)', () => {
  const payload = buildCreateOrderPayload({
    order: buildOrder(),
    courierCompany: 'sicepat',
    courierType: 'reg',
    config: buildConfig({ latitude: null, longitude: null }),
  });
  assert.equal('origin_coordinate' in payload, false);
});
