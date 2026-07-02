import crypto from 'node:crypto';
import { PaymentProvider } from '../provider';
import { paymentAttemptConfig, getMidtransSnapBaseUrl } from '../config';
import { PaymentAttemptError } from '../errors';

const MIDTRANS_TO_INTERNAL_STATUS = {
  capture: 'PAID',
  settlement: 'PAID',
  pending: 'PENDING',
  expire: 'EXPIRED',
  cancel: 'FAILED',
  deny: 'FAILED',
  refund: 'REFUNDED',
};

function toBasicAuthHeader(serverKey) {
  return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;
}

function splitCustomerName(fullName) {
  const normalized = String(fullName || '').trim();
  if (!normalized) {
    return { firstName: '', lastName: '' };
  }

  const [firstName, ...rest] = normalized.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(' '),
  };
}

function formatMidtransTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value || new Date());
  const pad = (input) => String(input).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const timezoneOffsetMinutes = -date.getTimezoneOffset();
  const sign = timezoneOffsetMinutes >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(timezoneOffsetMinutes) / 60));
  const offsetMinutes = pad(Math.abs(timezoneOffsetMinutes) % 60);
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${sign}${offsetHours}${offsetMinutes}`;
}

function buildCallbacks() {
  const baseUrl = paymentAttemptConfig.callbackBaseUrl.replace(/\/$/, '');
  return {
    finish: `${baseUrl}/`,
    unfinish: `${baseUrl}/`,
    error: `${baseUrl}/`,
  };
}

function buildOfficialSnapPayload(payload) {
  const { firstName, lastName } = splitCustomerName(payload.customer_name || `${payload.first_name || ''} ${payload.last_name || ''}`);

  return {
    transaction_details: {
      order_id: payload.order_number,
      gross_amount: Number(payload.gross_amount),
    },
    customer_details: {
      first_name: payload.first_name || firstName,
      last_name: payload.last_name || lastName,
      email: payload.email || '',
      phone: payload.phone || '',
    },
    credit_card: {
      secure: true,
    },
    callbacks: buildCallbacks(),
    expiry: {
      start_time: formatMidtransTimestamp(payload.created_at || new Date()),
      unit: 'day',
      duration: 1,
    },
  };
}

function normalizeMidtransError(responseStatus, responseBody = '') {
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

  if (responseStatus === 400) {
    return new PaymentAttemptError({
      message: 'Midtrans rejected the Snap payload.',
      statusCode: 502,
      code: 'PAYMENT_ATTEMPT_PROVIDER_BAD_REQUEST',
    });
  }

  return new PaymentAttemptError({
    message: 'Midtrans Snap token generation failed.',
    statusCode: 502,
    code: 'PAYMENT_ATTEMPT_PROVIDER_ERROR',
  });
}

function normalizeNotificationPayload(payload) {
  const transactionStatus = String(payload?.transaction_status || '').trim().toLowerCase();
  const mappedStatus = MIDTRANS_TO_INTERNAL_STATUS[transactionStatus];

  if (!mappedStatus) {
    throw new PaymentAttemptError({
      message: 'Midtrans notification status is unsupported.',
      statusCode: 400,
      code: 'PAYMENT_ATTEMPT_NOTIFICATION_STATUS_UNSUPPORTED',
    });
  }

  return {
    providerReference: String(payload?.order_id || '').trim(),
    providerTransactionId: String(payload?.transaction_id || '').trim(),
    transactionStatus,
    statusCode: String(payload?.status_code || '').trim(),
    grossAmount: String(payload?.gross_amount || '').trim(),
    signatureKey: String(payload?.signature_key || '').trim(),
    internalStatus: mappedStatus,
  };
}

export class MidtransProvider extends PaymentProvider {
  async createPaymentSession(payload) {
    if (!paymentAttemptConfig.midtransServerKey) {
      throw new PaymentAttemptError({
        message: 'Midtrans server key is not configured.',
        statusCode: 500,
        code: 'PAYMENT_ATTEMPT_PROVIDER_CONFIGURATION_MISSING',
      });
    }

    const requestPayload = buildOfficialSnapPayload(payload);

    const response = await fetch(getMidtransSnapBaseUrl(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: toBasicAuthHeader(paymentAttemptConfig.midtransServerKey),
      },
      body: JSON.stringify(requestPayload),
      cache: 'no-store',
    });

    const responseBody = await response.text();

    if (!response.ok) {
      console.error('[PaymentAttempt:MidtransProvider]', {
        orderNumber: payload.order_number,
        status: response.status,
        responseBody,
      });
      throw normalizeMidtransError(response.status, responseBody);
    }

    const data = responseBody ? JSON.parse(responseBody) : {};

    return {
      providerReference: payload.order_number,
      providerTransactionId: String(data.token || ''),
      snapToken: String(data.token || ''),
      redirectUrl: String(data.redirect_url || ''),
      snapRedirectUrl: String(data.redirect_url || ''),
      providerName: paymentAttemptConfig.providerName,
      createdAt: new Date().toISOString(),
    };
  }

  verifyNotificationSignature(payload) {
    if (!paymentAttemptConfig.midtransServerKey) {
      throw new PaymentAttemptError({
        message: 'Midtrans server key is not configured.',
        statusCode: 500,
        code: 'PAYMENT_ATTEMPT_PROVIDER_CONFIGURATION_MISSING',
      });
    }

    const notification = normalizeNotificationPayload(payload);
    const signatureSource = `${notification.providerReference}${notification.statusCode}${notification.grossAmount}${paymentAttemptConfig.midtransServerKey}`;
    const expectedSignature = crypto
      .createHash('sha512')
      .update(signatureSource)
      .digest('hex');

    if (!notification.signatureKey || expectedSignature !== notification.signatureKey) {
      throw new PaymentAttemptError({
        message: 'Midtrans notification signature is invalid.',
        statusCode: 401,
        code: 'PAYMENT_ATTEMPT_INVALID_SIGNATURE',
      });
    }

    return notification;
  }

  normalizeNotification(payload) {
    return normalizeNotificationPayload(payload);
  }
}
