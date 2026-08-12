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
