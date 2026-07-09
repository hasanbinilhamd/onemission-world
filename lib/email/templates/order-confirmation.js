import { getCommerceUrl } from '@/lib/config/urls';

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatOrderDate(value) {
  const date = value instanceof Date ? value : new Date(value || new Date());

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function buildShippingAddress(order) {
  const addressLine = [
    order.streetAddress,
    order.districtName,
    order.cityName,
    order.provinceName,
    order.postalCode,
  ].filter(Boolean).join(', ');

  return [order.recipientName, addressLine].filter(Boolean).join(' — ');
}

function buildCourierLabel(order) {
  return [order.courier, order.courierService].filter(Boolean).join(' ').trim() || 'To be assigned';
}

function buildTrackOrderUrl() {
  return getCommerceUrl('/track-order');
}

function buildOrderItemsRowsHtml(order) {
  return (order.items || []).map((item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; vertical-align: top;">
        <div style="font-weight: 600; color: #111827;">${item.productName}</div>
        <div style="font-size: 12px; color: #6B7280;">${item.variantName || 'Default'}</div>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">${formatCurrency(item.price)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">${formatCurrency(item.subtotal)}</td>
    </tr>
  `).join('');
}

function buildOrderItemsRowsText(order) {
  return (order.items || []).map((item) => (
    `- ${item.productName} (${item.variantName || 'Default'}) | Qty: ${item.quantity} | Unit Price: ${formatCurrency(item.price)} | Subtotal: ${formatCurrency(item.subtotal)}`
  )).join('\n');
}

export function buildOrderConfirmationEmailHtml({ order }) {
  const trackOrderUrl = buildTrackOrderUrl();

  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6; max-width: 640px; margin: 0 auto;">
      <p>Hello ${order.customerName},</p>
      <p>Thank you for your order. Your payment has been received successfully and your ONEMISSION order is now confirmed.</p>

      <div style="margin: 24px 0; padding: 20px; border: 1px solid #E5E7EB; border-radius: 20px; background: #FFFFFF;">
        <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827;">Order Summary</h2>
        <div style="display: grid; gap: 8px; font-size: 14px;">
          <div><strong>Order Number:</strong> ${order.publicOrderNumber}</div>
          <div><strong>Order Date:</strong> ${formatOrderDate(order.createdAt)}</div>
          <div><strong>Payment Status:</strong> ${order.paymentAttempt?.status || 'PAID'}</div>
          <div><strong>Shipping Address:</strong> ${buildShippingAddress(order)}</div>
          <div><strong>Courier:</strong> ${buildCourierLabel(order)}</div>
        </div>
      </div>

      <div style="margin: 24px 0; padding: 20px; border: 1px solid #E5E7EB; border-radius: 20px; background: #FFFFFF;">
        <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827;">Ordered Items</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: #F9FAFB; text-align: left;">
              <th style="padding: 12px; border-bottom: 1px solid #E5E7EB;">Item</th>
              <th style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: center;">Qty</th>
              <th style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">Unit Price</th>
              <th style="padding: 12px; border-bottom: 1px solid #E5E7EB; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${buildOrderItemsRowsHtml(order)}
          </tbody>
        </table>

        <div style="margin-top: 20px; display: grid; gap: 8px; font-size: 14px;">
          <div style="display: flex; justify-content: space-between;"><span>Shipping Cost</span><strong>${formatCurrency(order.shippingCost)}</strong></div>
          <div style="display: flex; justify-content: space-between;"><span>Grand Total</span><strong>${formatCurrency(order.grandTotal)}</strong></div>
        </div>
      </div>

      <p style="margin: 24px 0;">
        <a
          href="${trackOrderUrl}"
          style="display: inline-block; padding: 12px 20px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600;"
        >
          Track My Order
        </a>
      </p>

      <p>Thank you for supporting ONEMISSION.</p>
    </div>
  `;
}

export function buildOrderConfirmationEmailText({ order }) {
  return [
    `Hello ${order.customerName},`,
    '',
    'Thank you for your order. Your payment has been received successfully and your ONEMISSION order is now confirmed.',
    '',
    `Order Number: ${order.publicOrderNumber}`,
    `Order Date: ${formatOrderDate(order.createdAt)}`,
    `Payment Status: ${order.paymentAttempt?.status || 'PAID'}`,
    `Shipping Address: ${buildShippingAddress(order)}`,
    `Courier: ${buildCourierLabel(order)}`,
    '',
    'Ordered Items:',
    buildOrderItemsRowsText(order),
    '',
    `Shipping Cost: ${formatCurrency(order.shippingCost)}`,
    `Grand Total: ${formatCurrency(order.grandTotal)}`,
    '',
    `Track My Order: ${buildTrackOrderUrl()}`,
    '',
    'Thank you for supporting ONEMISSION.',
  ].join('\n');
}
