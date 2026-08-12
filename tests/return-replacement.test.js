import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReplacementVariantExchange } from '../lib/returns/replacement.js';

test('allows same product same price same quantity variant exchange', () => {
  const result = validateReplacementVariantExchange({
    originalProductId: 'product-1',
    replacementProductId: 'product-1',
    originalUnitPrice: 200000,
    replacementUnitPrice: 200000,
    returnedQuantity: 2,
    replacementQuantity: 2,
  });
  assert.equal(result.valid, true);
});

test('rejects replacement with different product', () => {
  const result = validateReplacementVariantExchange({
    originalProductId: 'product-1',
    replacementProductId: 'product-2',
    originalUnitPrice: 200000,
    replacementUnitPrice: 200000,
    returnedQuantity: 1,
    replacementQuantity: 1,
  });
  assert.equal(result.valid, false);
  assert.equal(result.code, 'RETURN_REPLACEMENT_PRODUCT_MISMATCH');
});

test('rejects replacement with different price', () => {
  const result = validateReplacementVariantExchange({
    originalProductId: 'product-1',
    replacementProductId: 'product-1',
    originalUnitPrice: 200000,
    replacementUnitPrice: 250000,
    returnedQuantity: 1,
    replacementQuantity: 1,
  });
  assert.equal(result.valid, false);
  assert.equal(result.code, 'RETURN_REPLACEMENT_PRICE_MISMATCH');
});

test('rejects replacement with different quantity', () => {
  const result = validateReplacementVariantExchange({
    originalProductId: 'product-1',
    replacementProductId: 'product-1',
    originalUnitPrice: 200000,
    replacementUnitPrice: 200000,
    returnedQuantity: 2,
    replacementQuantity: 1,
  });
  assert.equal(result.valid, false);
  assert.equal(result.code, 'RETURN_REPLACEMENT_QUANTITY_MISMATCH');
});

import {
  buildReplacementOutStockState,
  buildReturnInStockState,
} from '../lib/returns/stock-allocation.js';

test('return stock allocation adds returned quantity to real stock only', () => {
  assert.deepEqual(buildReturnInStockState({ realStock: 10, websiteStock: 4, quantity: 1 }), {
    realStock: 11,
    websiteStock: 4,
  });
});

test('replacement stock allocation deducts physical stock and keeps website invariant', () => {
  assert.deepEqual(buildReplacementOutStockState({ realStock: 10, websiteStock: 4, quantity: 3 }), {
    valid: true,
    realStock: 7,
    websiteStock: 4,
    message: '',
  });
  assert.deepEqual(buildReplacementOutStockState({ realStock: 5, websiteStock: 4, quantity: 3 }), {
    valid: true,
    realStock: 2,
    websiteStock: 2,
    message: '',
  });
});

test('replacement stock allocation rejects insufficient physical stock', () => {
  const result = buildReplacementOutStockState({ realStock: 0, websiteStock: 0, quantity: 1 });
  assert.equal(result.valid, false);
});

import {
  buildReturnStockAllocationIdentity,
  validateCumulativeReturnQuantity,
} from '../lib/returns/stock-allocation.js';

test('full refund allocation adds full returned quantity to real stock only', () => {
  assert.deepEqual(buildReturnInStockState({ realStock: 10, websiteStock: 4, quantity: 3 }), {
    realStock: 13,
    websiteStock: 4,
  });
});

test('partial replacement allocation adds returned variant and deducts replacement variant', () => {
  const returned = buildReturnInStockState({ realStock: 5, websiteStock: 2, quantity: 1 });
  const replacement = buildReplacementOutStockState({ realStock: 4, websiteStock: 1, quantity: 1 });
  assert.equal(returned.realStock, 6);
  assert.equal(returned.websiteStock, 2);
  assert.equal(replacement.valid, true);
  assert.equal(replacement.realStock, 3);
});

test('full replacement allocation supports matching full returned and replacement quantity', () => {
  const returned = buildReturnInStockState({ realStock: 5, websiteStock: 2, quantity: 3 });
  const replacement = buildReplacementOutStockState({ realStock: 4, websiteStock: 1, quantity: 3 });
  assert.equal(returned.realStock, 8);
  assert.equal(replacement.valid, true);
  assert.equal(replacement.realStock, 1);
});

test('allocation identity is deterministic for idempotency', () => {
  assert.deepEqual(
    buildReturnStockAllocationIdentity({ returnRequestId: 'ret-1', returnRequestItemId: 'item-1', allocationType: 'RETURN_IN' }),
    buildReturnStockAllocationIdentity({ returnRequestId: 'ret-1', returnRequestItemId: 'item-1', allocationType: 'RETURN_IN' }),
  );
});

test('cumulative return quantity cannot exceed purchased quantity', () => {
  assert.equal(validateCumulativeReturnQuantity({ purchasedQuantity: 3, existingReturnedQuantity: 2, requestedQuantity: 1 }).valid, true);
  assert.equal(validateCumulativeReturnQuantity({ purchasedQuantity: 3, existingReturnedQuantity: 3, requestedQuantity: 1 }).valid, false);
});
