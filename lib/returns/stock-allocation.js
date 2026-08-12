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
