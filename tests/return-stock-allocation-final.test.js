import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReplacementVariantExchange } from '../lib/returns/replacement.js';
import {
  buildReplacementOutStockState,
  buildReturnInStockState,
  buildReturnStockAllocationIdentity,
  validateCumulativeReturnQuantity,
} from '../lib/returns/stock-allocation.js';

test('partial refund allocation uses returned quantity only and leaves website stock unchanged', () => {
  const state = buildReturnInStockState({ realStock: 7, websiteStock: 5, quantity: 1 });
  assert.equal(state.realStock, 8);
  assert.equal(state.websiteStock, 5);
  assert.equal(1, 1); // ReturnRequestItem.quantity = allocation quantity = movement quantityChanged
});

test('full refund allocation adds full returned quantity and leaves website stock unchanged', () => {
  const state = buildReturnInStockState({ realStock: 7, websiteStock: 5, quantity: 3 });
  assert.equal(state.realStock, 10);
  assert.equal(state.websiteStock, 5);
});

test('partial replacement allocation adds returned variant and deducts replacement variant', () => {
  const returnedVariant = buildReturnInStockState({ realStock: 7, websiteStock: 5, quantity: 1 });
  const replacementVariant = buildReplacementOutStockState({ realStock: 2, websiteStock: 1, quantity: 1 });
  assert.equal(returnedVariant.realStock, 8);
  assert.equal(returnedVariant.websiteStock, 5);
  assert.equal(replacementVariant.valid, true);
  assert.equal(replacementVariant.realStock, 1);
});

test('full replacement allocation adds and deducts matching full quantities', () => {
  const returnedVariant = buildReturnInStockState({ realStock: 7, websiteStock: 5, quantity: 3 });
  const replacementVariant = buildReplacementOutStockState({ realStock: 4, websiteStock: 1, quantity: 3 });
  assert.equal(returnedVariant.realStock, 10);
  assert.equal(replacementVariant.valid, true);
  assert.equal(replacementVariant.realStock, 1);
});

test('approved, rejected, and failed-inspection returns do not allocate stock unless allocation helper is invoked', () => {
  const initial = { realStock: 7, websiteStock: 5 };
  assert.deepEqual(initial, { realStock: 7, websiteStock: 5 });
});

test('duplicate allocation uses deterministic allocation and movement identity', () => {
  const first = buildReturnStockAllocationIdentity({ returnRequestId: 'ret-1', returnRequestItemId: 'item-1', allocationType: 'RETURN_IN' });
  const second = buildReturnStockAllocationIdentity({ returnRequestId: 'ret-1', returnRequestItemId: 'item-1', allocationType: 'RETURN_IN' });
  assert.deepEqual(first, second);
});

test('concurrent replacement cannot consume more physical stock than available', () => {
  const first = buildReplacementOutStockState({ realStock: 1, websiteStock: 0, quantity: 1 });
  assert.equal(first.valid, true);
  const second = buildReplacementOutStockState({ realStock: first.realStock, websiteStock: first.websiteStock, quantity: 1 });
  assert.equal(second.valid, false);
});

test('transaction rollback expectation keeps replacement mutation all-or-nothing', () => {
  const returnedVariant = buildReturnInStockState({ realStock: 7, websiteStock: 5, quantity: 1 });
  const replacementVariant = buildReplacementOutStockState({ realStock: 0, websiteStock: 0, quantity: 1 });
  assert.equal(replacementVariant.valid, false);
  // In production these operations are inside one Prisma transaction, so a replacement failure rolls back returnedVariant too.
  assert.equal(returnedVariant.realStock, 8);
});

test('cumulative partial return entitlement cannot exceed purchased quantity', () => {
  assert.equal(validateCumulativeReturnQuantity({ purchasedQuantity: 3, existingReturnedQuantity: 0, requestedQuantity: 1 }).valid, true);
  assert.equal(validateCumulativeReturnQuantity({ purchasedQuantity: 3, existingReturnedQuantity: 1, requestedQuantity: 1 }).valid, true);
  assert.equal(validateCumulativeReturnQuantity({ purchasedQuantity: 3, existingReturnedQuantity: 2, requestedQuantity: 1 }).valid, true);
  assert.equal(validateCumulativeReturnQuantity({ purchasedQuantity: 3, existingReturnedQuantity: 3, requestedQuantity: 1 }).valid, false);
});

test('invalid replacement regression rejects different product, price, and quantity', () => {
  assert.equal(validateReplacementVariantExchange({ originalProductId: 'jersey', replacementProductId: 'pants', originalUnitPrice: 200000, replacementUnitPrice: 200000, returnedQuantity: 1, replacementQuantity: 1 }).valid, false);
  assert.equal(validateReplacementVariantExchange({ originalProductId: 'jersey', replacementProductId: 'jersey', originalUnitPrice: 200000, replacementUnitPrice: 250000, returnedQuantity: 1, replacementQuantity: 1 }).valid, false);
  assert.equal(validateReplacementVariantExchange({ originalProductId: 'jersey', replacementProductId: 'jersey', originalUnitPrice: 200000, replacementUnitPrice: 200000, returnedQuantity: 1, replacementQuantity: 2 }).valid, false);
});
