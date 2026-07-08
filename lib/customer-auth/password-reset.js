import crypto from 'crypto';
import { getCustomerAppUrl, getPasswordResetTtlSeconds } from './config';

export function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export function generatePasswordResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + getPasswordResetTtlSeconds() * 1000);

  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt,
  };
}

export function buildPasswordResetUrl(token) {
  const appUrl = getCustomerAppUrl();
  return `${appUrl}/reset-password?token=${encodeURIComponent(String(token || ''))}`;
}
