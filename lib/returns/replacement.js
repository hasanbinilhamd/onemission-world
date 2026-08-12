const PRICE_TOLERANCE = 0.009;

export function validateReplacementVariantExchange({
  originalProductId = '',
  replacementProductId = '',
  originalUnitPrice = 0,
  replacementUnitPrice = 0,
  returnedQuantity = 0,
  replacementQuantity = 0,
} = {}) {
  if (!originalProductId || !replacementProductId || String(originalProductId) !== String(replacementProductId)) {
    return {
      valid: false,
      code: 'RETURN_REPLACEMENT_PRODUCT_MISMATCH',
      message: 'Replacement must use a variant from the same product.',
    };
  }

  if (Number(returnedQuantity || 0) !== Number(replacementQuantity || 0)) {
    return {
      valid: false,
      code: 'RETURN_REPLACEMENT_QUANTITY_MISMATCH',
      message: 'Replacement quantity must match returned quantity.',
    };
  }

  if (Math.abs(Number(originalUnitPrice || 0) - Number(replacementUnitPrice || 0)) > PRICE_TOLERANCE) {
    return {
      valid: false,
      code: 'RETURN_REPLACEMENT_PRICE_MISMATCH',
      message: 'Replacement variant must have the same unit price as the original item.',
    };
  }

  return { valid: true, code: '', message: '' };
}
