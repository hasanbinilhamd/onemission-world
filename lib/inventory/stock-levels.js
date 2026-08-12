export function normalizeStockLevel(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(Math.trunc(Number(fallback) || 0), 0);
  return Math.max(Math.trunc(parsed), 0);
}

export function buildInventoryStockState({ quantity = 0, realStock, websiteStock } = {}) {
  const normalizedQuantity = normalizeStockLevel(quantity);
  const normalizedRealStock = normalizeStockLevel(realStock ?? normalizedQuantity, normalizedQuantity);
  const normalizedWebsiteStock = normalizeStockLevel(websiteStock ?? normalizedQuantity, normalizedQuantity);

  return {
    quantity: normalizedQuantity,
    realStock: normalizedRealStock,
    websiteStock: Math.min(normalizedWebsiteStock, normalizedRealStock),
  };
}

export function validateInventoryStockState({ realStock = 0, websiteStock = 0 } = {}) {
  const normalizedRealStock = Number(realStock);
  const normalizedWebsiteStock = Number(websiteStock);

  if (!Number.isFinite(normalizedRealStock) || normalizedRealStock < 0) {
    return { valid: false, message: 'Real Stock cannot be negative.' };
  }

  if (!Number.isFinite(normalizedWebsiteStock) || normalizedWebsiteStock < 0) {
    return { valid: false, message: 'Website Stock cannot be negative.' };
  }

  if (normalizedWebsiteStock > normalizedRealStock) {
    return { valid: false, message: 'Website Stock cannot exceed Real Stock.' };
  }

  return { valid: true, message: '' };
}

export function buildStockUpdateForQuantityChange(nextQuantity, current = {}) {
  const quantity = normalizeStockLevel(nextQuantity);
  return {
    quantity,
    realStock: quantity,
    websiteStock: Math.min(normalizeStockLevel(current.websiteStock ?? current.quantity ?? 0), quantity),
  };
}

export function buildWebsiteSaleStockState({ realStock = 0, websiteStock = 0, quantity = 0, deduction = 0 } = {}) {
  const requested = normalizeStockLevel(deduction);
  const nextRealStock = normalizeStockLevel(realStock) - requested;
  const nextWebsiteStock = normalizeStockLevel(websiteStock ?? quantity) - requested;

  if (nextRealStock < 0 || nextWebsiteStock < 0) {
    return { valid: false, message: 'Website stock is insufficient.' };
  }

  return {
    valid: true,
    realStock: nextRealStock,
    websiteStock: nextWebsiteStock,
    quantity: nextWebsiteStock,
    message: '',
  };
}
