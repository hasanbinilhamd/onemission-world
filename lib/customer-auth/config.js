import { CustomerAuthError } from './errors';

export function parseDurationToSeconds(value, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  const match = normalized.match(/^(\d+)([smhd])$/);

  if (!match) {
    throw new CustomerAuthError({
      message: `Invalid duration value: ${value}`,
      statusCode: 500,
      code: 'CUSTOMER_AUTH_INVALID_DURATION',
    });
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];

  const multiplier = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
  }[unit];

  return amount * multiplier;
}

export const customerAuthConfig = {
  appUrl: String(process.env.APP_URL || '').trim(),
  jwtSecret: String(process.env.JWT_SECRET || '').trim(),
  accessTokenExpiresIn: String(process.env.JWT_ACCESS_EXPIRES || '15m').trim(),
  refreshTokenExpiresIn: String(process.env.JWT_REFRESH_EXPIRES || '30d').trim(),
  passwordResetExpiresIn: String(process.env.PASSWORD_RESET_EXPIRES || '60m').trim(),
  googleClientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
  googleClientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
};

export function getCustomerAppUrl() {
  if (!customerAuthConfig.appUrl) {
    throw new CustomerAuthError({
      message: 'APP_URL is not configured.',
      statusCode: 500,
      code: 'CUSTOMER_AUTH_APP_URL_MISSING',
    });
  }

  return customerAuthConfig.appUrl.replace(/\/$/, '');
}

export function getCustomerJwtSecret() {
  if (!customerAuthConfig.jwtSecret) {
    throw new CustomerAuthError({
      message: 'JWT_SECRET is not configured.',
      statusCode: 500,
      code: 'CUSTOMER_AUTH_SECRET_MISSING',
    });
  }

  return customerAuthConfig.jwtSecret;
}

export function getAccessTokenTtlSeconds() {
  return parseDurationToSeconds(customerAuthConfig.accessTokenExpiresIn, '15m');
}

export function getRefreshTokenTtlSeconds() {
  return parseDurationToSeconds(customerAuthConfig.refreshTokenExpiresIn, '30d');
}

export function getPasswordResetTtlSeconds() {
  return parseDurationToSeconds(customerAuthConfig.passwordResetExpiresIn, '60m');
}
