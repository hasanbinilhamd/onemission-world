import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { customerAuthConfig, getAccessTokenTtlSeconds, getCustomerJwtSecret, getRefreshTokenTtlSeconds } from './config';
import { CUSTOMER_AUTH_TOKEN_TYPE } from './constants';
import { CustomerAuthError } from './errors';

function getJwtSecretKey() {
  return new TextEncoder().encode(getCustomerJwtSecret());
}

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

export async function issueCustomerAccessToken({ customer, sessionId }) {
  const expiresInSeconds = getAccessTokenTtlSeconds();
  const token = await new SignJWT({
    type: CUSTOMER_AUTH_TOKEN_TYPE.ACCESS,
    email: customer.email || '',
    customerName: customer.customerName || '',
    authProvider: customer.authProvider || '',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(customer.id)
    .setAudience(buildJwtAudience(CUSTOMER_AUTH_TOKEN_TYPE.ACCESS))
    .setIssuedAt()
    .setExpirationTime(expiresInSeconds)
    .setJti(sessionId)
    .sign(getJwtSecretKey());

  return {
    token,
    expiresAt: buildExpiresAt(expiresInSeconds),
  };
}

export async function issueCustomerRefreshToken({ customerId, sessionId }) {
  const expiresInSeconds = getRefreshTokenTtlSeconds();
  const token = await new SignJWT({
    type: CUSTOMER_AUTH_TOKEN_TYPE.REFRESH,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(customerId)
    .setAudience(buildJwtAudience(CUSTOMER_AUTH_TOKEN_TYPE.REFRESH))
    .setIssuedAt()
    .setExpirationTime(expiresInSeconds)
    .setJti(sessionId)
    .sign(getJwtSecretKey());

  return {
    token,
    expiresAt: buildExpiresAt(expiresInSeconds),
  };
}

async function verifyToken(token, expectedType) {
  try {
    const { payload } = await jwtVerify(String(token || ''), getJwtSecretKey(), {
      audience: buildJwtAudience(expectedType),
    });

    if (payload.type !== expectedType) {
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
    const [, payload = ''] = String(token || '').split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
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
