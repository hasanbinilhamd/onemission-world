function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveStatusCopy(statusType) {
  if (statusType === 'SHIPPED') {
    return {
      heading: 'Your order has been shipped',
      body: 'Your package has been handed over to the courier and is on the way.',
    };
  }

  return {
    heading: 'Your order has been delivered',
    body: 'Your package has been marked as delivered. Thank you for shopping with ONEMISSION.',
  };
}

export function buildOrderStatusUpdateEmailHtml({ order, statusType }) {
  const copy = resolveStatusCopy(statusType);
  return `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
      <h2>${copy.heading}</h2>
      <p>Assalamu’alaikum ${order?.customerName || 'Customer'},</p>
      <p>${copy.body}</p>
      <div style="border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 16px 0;">
        <p><strong>Order Number:</strong> ${order?.publicOrderNumber || order?.orderNumber || '—'}</p>
        <p><strong>Courier:</strong> ${order?.shipmentCourier || order?.shipping?.courier || '—'}</p>
        <p><strong>Service:</strong> ${order?.shipmentService || order?.shipping?.courierService || '—'}</p>
        <p><strong>Tracking Number:</strong> ${order?.trackingNumber || order?.shipment?.trackingNumber || '—'}</p>
        <p><strong>Shipping Date:</strong> ${formatDateTime(order?.shippingDate || order?.shipment?.shippingDate)}</p>
        <p><strong>Total:</strong> ${formatCurrency(order?.grandTotal)}</p>
      </div>
      <p>Barakallahu fiikum.</p>
    </div>
  `;
}

export function buildOrderStatusUpdateEmailText({ order, statusType }) {
  const copy = resolveStatusCopy(statusType);
  return [
    copy.heading,
    '',
    `Assalamu’alaikum ${order?.customerName || 'Customer'},`,
    copy.body,
    '',
    `Order Number: ${order?.publicOrderNumber || order?.orderNumber || '—'}`,
    `Courier: ${order?.shipmentCourier || order?.shipping?.courier || '—'}`,
    `Service: ${order?.shipmentService || order?.shipping?.courierService || '—'}`,
    `Tracking Number: ${order?.trackingNumber || order?.shipment?.trackingNumber || '—'}`,
    `Shipping Date: ${formatDateTime(order?.shippingDate || order?.shipment?.shippingDate)}`,
    `Total: ${formatCurrency(order?.grandTotal)}`,
    '',
    'Barakallahu fiikum.',
  ].join('\n');
}
