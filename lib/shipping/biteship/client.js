import { getBiteshipConfig } from './config';

export class BiteshipApiError extends Error {
  constructor({ message, statusCode = 500, code = 'BITESHIP_API_ERROR', response = null } = {}) {
    super(message || 'Biteship request failed.');
    this.name = 'BiteshipApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.response = response;
  }
}

function buildTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function normalizeBiteshipErrorMessage(status, payload) {
  if (status === 401 || status === 403) return 'Biteship authorization failed. Please check shipping provider credentials.';
  if (status === 404) return 'Biteship shipment could not be found.';
  if (status === 409) return 'Biteship rejected this request because the shipment state has changed.';
  if (status === 422 || status === 400) return payload?.error || payload?.message || 'Biteship did not accept the shipment request.';
  if (status === 429) return 'Biteship rate limit was reached. Please wait and try again.';
  if (status >= 500) return 'Biteship is currently unavailable. Please try again later.';
  return payload?.error || payload?.message || 'Biteship request failed.';
}

export class BiteshipClient {
  constructor(config = getBiteshipConfig()) {
    this.config = config;
  }

  ensureConfigured() {
    if (!this.config.apiKey) {
      throw new BiteshipApiError({
        message: 'Biteship API key is not configured.',
        statusCode: 500,
        code: 'BITESHIP_API_KEY_MISSING',
      });
    }
  }

  async request(path, { method = 'GET', body = null } = {}) {
    this.ensureConfigured();
    const timeout = buildTimeoutSignal(this.config.timeoutMs);
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;

    try {
      const response = await fetch(url, {
        method,
        signal: timeout.signal,
        headers: {
          Authorization: this.config.apiKey,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new BiteshipApiError({
          message: normalizeBiteshipErrorMessage(response.status, payload),
          statusCode: response.status || 502,
          code: String(payload?.code || `BITESHIP_HTTP_${response.status || 500}`),
          response: payload,
        });
      }
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new BiteshipApiError({
          message: 'Biteship request timed out. No changes were made to the order.',
          statusCode: 504,
          code: 'BITESHIP_TIMEOUT',
        });
      }
      if (error instanceof BiteshipApiError) throw error;
      throw new BiteshipApiError({
        message: error?.message || 'Biteship request failed.',
        statusCode: 502,
        code: 'BITESHIP_NETWORK_ERROR',
      });
    } finally {
      timeout.clear();
    }
  }

  createOrder(payload) {
    return this.request('/v1/orders', { method: 'POST', body: payload });
  }

  retrieveRates(payload) {
    return this.request('/v1/rates/couriers', { method: 'POST', body: payload });
  }

  retrieveOrder(orderId) {
    return this.request(`/v1/orders/${encodeURIComponent(orderId)}`);
  }

  cancelOrder(orderId) {
    return this.request(`/v1/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
  }
}

export const biteshipClient = new BiteshipClient();
