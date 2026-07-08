import { getCommerceUrl, urls } from '@/lib/config/urls';

function parseMidtransProductionFlag(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function parseMidtransTimeout(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000;
}

export const paymentAttemptConfig = {
  provider: 'MIDTRANS',
  providerName: 'Midtrans Snap',
  midtransServerKey: (process.env.MIDTRANS_SERVER_KEY || '').trim(),
  midtransClientKey: (process.env.MIDTRANS_CLIENT_KEY || '').trim(),
  midtransIsProduction: parseMidtransProductionFlag(process.env.MIDTRANS_IS_PRODUCTION),
  midtransTimeout: parseMidtransTimeout(process.env.MIDTRANS_TIMEOUT),
  callbackBaseUrl: getCommerceUrl('/'),
  hqBaseUrl: urls.hq,
};

export function getMidtransSnapBaseUrl() {
  return paymentAttemptConfig.midtransIsProduction
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
}
