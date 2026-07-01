export function calculateItemSubtotal(price, quantity) {
  return Number(price) * Number(quantity);
}

export function calculateSubtotal(items) {
  return items.reduce((sum, item) => sum + item.subtotal, 0);
}

export function calculateGrandTotal({ subtotal, discount, shippingCost, tax }) {
  return subtotal - discount + shippingCost + tax;
}
