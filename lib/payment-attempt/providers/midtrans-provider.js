import { PaymentProvider } from '../provider';
import { paymentAttemptConfig, getMidtransSnapBaseUrl } from '../config';
import { PaymentAttemptError } from '../errors';

function toBasicAuthHeader(serverKey) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;
}

function buildItemDetails(items) {
  return items.map((item) => ({
    id: item.variantId || item.productId,
    price: Number(item.price),
    quantity: Number(item.quantity ?? item.qty),
    name: `${item.productName} - ${item.variantName}`.slice(0, 50),
  }));
}

function buildCustomerDetails(checkoutSession) {
  return {
    first_name: checkoutSession.shipping?.recipientName || checkoutSession.customer?.customerName || '',
    last_name: '',
    email: checkoutSession.customer?.email || '',
    phone: checkoutSession.shipping?.phone || checkoutSession.customer?.phone || '',
    billing_address: {
      first_name: checkoutSession.shipping?.recipientName || checkoutSession.customer?.customerName || '',
      last_name: '',
      phone: checkoutSession.shipping?.phone || checkoutSession.customer?.phone || '',
      address: checkoutSession.shipping?.address?.streetAddress || '',
      city: checkoutSession.shipping?.address?.city || '',
      postal_code: checkoutSession.shipping?.address?.postalCode || '',
      country_code: 'IDN',
    },
    shipping_address: {
      first_name: checkoutSession.shipping?.recipientName || checkoutSession.customer?.customerName || '',
      last_name: '',
      phone: checkoutSession.shipping?.phone || checkoutSession.customer?.phone || '',
      address: checkoutSession.shipping?.address?.streetAddress || '',
      city: checkoutSession.shipping?.address?.city || '',
      postal_code: checkoutSession.shipping?.address?.postalCode || '',
      country_code: 'IDN',
    },
  };
}

function normalizeMidtransError(responseStatus, responseText) {
  if (responseStatus === 401 || responseStatus === 403) {
    return new PaymentAttemptError({
      message: 'Midtrans credentials are invalid.',
      statusCode: 502,
      code: 'PAYMENT_ATTEMPT_PROVIDER_UNAUTHORIZED',
    });
  }

  if (responseStatus >= 500) {
    return new PaymentAttemptError({
      message: 'Midtrans is currently unavailable.',
      statusCode: 503,
      code: 'PAYMENT_ATTEMPT_PROVIDER_UNAVAILABLE',
    });
  }

  return new PaymentAttemptError({
    message: 'Midtrans Snap token generation failed.',
    statusCode: 502,
    code: 'PAYMENT_ATTEMPT_PROVIDER_ERROR',
  });
}

export class MidtransProvider extends PaymentProvider {
  async createPaymentSession({ paymentAttempt, checkoutSession }) {
    if (!paymentAttemptConfig.midtransServerKey) {
      throw new PaymentAttemptError({
        message: 'Midtrans server key is not configured.',
        statusCode: 500,
        code: 'PAYMENT_ATTEMPT_PROVIDER_CONFIGURATION_MISSING',
      });
    }

    const payload = {
      transaction_details: {
        order_id: paymentAttempt.providerReference || paymentAttempt.attemptNumber,
        gross_amount: Number(paymentAttempt.grossAmount),
      },
      item_details: buildItemDetails(checkoutSession.items || []),
      customer_details: buildCustomerDetails(checkoutSession),
      expiry: {
        start_time: new Date(paymentAttempt.createdAt || new Date()).toISOString(),
        unit: 'day',
        duration: 1,
      },
    };

    const response = await fetch(getMidtransSnapBaseUrl(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: toBasicAuthHeader(paymentAttemptConfig.midtransServerKey),
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error('[PaymentAttempt:MidtransProvider]', {
        attemptNumber: paymentAttempt.attemptNumber,
        status: response.status,
        message: 'Midtrans request failed.',
      });
      throw normalizeMidtransError(response.status, responseText);
    }

    const data = await response.json();

    return {
      providerReference: paymentAttempt.providerReference || paymentAttempt.attemptNumber,
      providerTransactionId: String(data.token || ''),
      snapToken: String(data.token || ''),
      snapRedirectUrl: String(data.redirect_url || ''),
    };
  }
}
