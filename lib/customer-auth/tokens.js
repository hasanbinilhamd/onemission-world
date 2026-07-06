import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getAccessTokenTtlSeconds, getCustomerJwtSecret, getRefreshTokenTtlSeconds } from './config';
import { CUSTOMER_AUTH_TOKEN_TYPE } from './constants';
import { CustomerAuthError } from './errors';

function buildJwtAudience(tokenType) {
  return tokenType === CUSTOMER_AUTH_TOKEN_TYPE.ACCESS
    ? 'onemission-customer-access'
    : 'onemission-customer-refresh';
}

function buildExpiresAt(seconds) {
  return new Date(Date.now() + seconds * 1000);
}

export function hashRefreshToken(refreshToken) {
  return crypto.createHash('sha256').update(String(refreshToken || '')).digest('hex');
}

function signCustomerToken({ payload, subject, audience, expiresInSeconds, sessionId }) {
  return jwt.sign(payload, getCustomerJwtSecret(), {
    algorithm: 'HS256',
    subject,
    audience,
    expiresIn: expiresInSeconds,
    jwtid: sessionId,
  });
}

export async function issueCustomerAccessToken({ customer, sessionId }) {
  const expiresInSeconds = getAccessTokenTtlSeconds();
  const token = signCustomerToken({
    payload: {
      type: CUSTOMER_AUTH_TOKEN_TYPE.ACCESS,
      email: customer.email || '',
      customerName: customer.customerName || '',
      authProvider: customer.authProvider || '',
    },
    subject: customer.id,
    audience: buildJwtAudience(CUSTOMER_AUTH_TOKEN_TYPE.ACCESS),
    expiresInSeconds,
    sessionId,
  });

  return {
    token,
    expiresAt: buildExpiresAt(expiresInSeconds),
  };
}

export async function issueCustomerRefreshToken({ customerId, sessionId }) {
  const expiresInSeconds = getRefreshTokenTtlSeconds();
  const token = signCustomerToken({
    payload: {
      type: CUSTOMER_AUTH_TOKEN_TYPE.REFRESH,
    },
    subject: customerId,
    audience: buildJwtAudience(CUSTOMER_AUTH_TOKEN_TYPE.REFRESH),
    expiresInSeconds,
    sessionId,
  });

  return {
    token,
    expiresAt: buildExpiresAt(expiresInSeconds),
  };
}

async function verifyToken(token, expectedType) {
  try {
    const payload = jwt.verify(String(token || ''), getCustomerJwtSecret(), {
      algorithms: ['HS256'],
      audience: buildJwtAudience(expectedType),
    });

    if (typeof payload !== 'object' || payload === null || payload.type !== expectedType) {
      throw new CustomerAuthError({
        message: 'Customer token type is invalid.',
        statusCode: 401,
        code: 'CUSTOMER_AUTH_TOKEN_TYPE_INVALID',
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof CustomerAuthError) {
      throw error;
    }

    throw new CustomerAuthError({
      message: 'Customer token is invalid or expired.',
      statusCode: 401,
      code: 'CUSTOMER_AUTH_TOKEN_INVALID',
    });
  }
}

export function decodeCustomerJwtPayload(token) {
  try {
    const payload = jwt.decode(String(token || ''));
    return typeof payload === 'object' && payload !== null ? payload : null;
  } catch {
    return null;
  }
}

export async function verifyCustomerAccessToken(token) {
  return verifyToken(token, CUSTOMER_AUTH_TOKEN_TYPE.ACCESS);
}

export async function verifyCustomerRefreshToken(token) {
  return verifyToken(token, CUSTOMER_AUTH_TOKEN_TYPE.REFRESH);
}
