export function buildReturnInStockState({ realStock = 0, websiteStock = 0, quantity = 0 } = {}) {
  const returnedQuantity = Number(quantity || 0);
  return {
    realStock: Number(realStock || 0) + returnedQuantity,
    websiteStock: Number(websiteStock || 0),
  };
}

export function buildReplacementOutStockState({ realStock = 0, websiteStock = 0, quantity = 0 } = {}) {
  const replacementQuantity = Number(quantity || 0);
  const nextRealStock = Number(realStock || 0) - replacementQuantity;
  if (nextRealStock < 0) {
    return { valid: false, message: 'Replacement stock is insufficient.' };
  }
  return {
    valid: true,
    realStock: nextRealStock,
    websiteStock: Math.min(Number(websiteStock || 0), nextRealStock),
    message: '',
  };
}

export function buildReturnStockAllocationIdentity({ returnRequestId = '', returnRequestItemId = '', allocationType = '' } = {}) {
  const type = String(allocationType || '').trim();
  return {
    allocationId: `return-stock-${returnRequestId}-${returnRequestItemId}-${type}`,
    movementId: `return-movement-${returnRequestId}-${returnRequestItemId}-${type}`,
  };
}

export function validateCumulativeReturnQuantity({ purchasedQuantity = 0, existingReturnedQuantity = 0, requestedQuantity = 0 } = {}) {
  const purchased = Number(purchasedQuantity || 0);
  const existing = Number(existingReturnedQuantity || 0);
  const requested = Number(requestedQuantity || 0);
  if (requested <= 0) return { valid: false, message: 'Return quantity must be greater than 0.' };
  if (existing + requested > purchased) {
    return { valid: false, message: 'Return quantity exceeds purchased quantity.' };
  }
  return { valid: true, message: '' };
}
