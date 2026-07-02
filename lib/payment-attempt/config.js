function parseMidtransProductionFlag(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function resolveCallbackBaseUrl() {
  const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean);
  const firstOrigin = corsOrigins.find((value) => value !== '*');
  return firstOrigin || 'http://localhost:3000';
}

export const paymentAttemptConfig = {
  provider: 'MIDTRANS',
  providerName: 'Midtrans Snap',
  midtransServerKey: (process.env.MIDTRANS_SERVER_KEY || '').trim(),
  midtransClientKey: (process.env.MIDTRANS_CLIENT_KEY || '').trim(),
  midtransIsProduction: parseMidtransProductionFlag(process.env.MIDTRANS_IS_PRODUCTION),
  callbackBaseUrl: resolveCallbackBaseUrl(),
};

export function getMidtransSnapBaseUrl() {
  return paymentAttemptConfig.midtransIsProduction
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
}
