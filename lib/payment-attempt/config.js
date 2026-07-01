function parseMidtransProductionFlag(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

export const paymentAttemptConfig = {
  provider: 'MIDTRANS',
  midtransServerKey: (process.env.MIDTRANS_SERVER_KEY || '').trim(),
  midtransClientKey: (process.env.MIDTRANS_CLIENT_KEY || '').trim(),
  midtransIsProduction: parseMidtransProductionFlag(process.env.MIDTRANS_IS_PRODUCTION),
};

export function getMidtransSnapBaseUrl() {
  return paymentAttemptConfig.midtransIsProduction
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
}
