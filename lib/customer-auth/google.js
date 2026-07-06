import { createRemoteJWKSet, jwtVerify } from 'jose';
import { customerAuthConfig } from './config';
import { CustomerAuthError } from './errors';

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export async function verifyGoogleIdentityToken(idToken) {
  if (!customerAuthConfig.googleClientId) {
    throw new CustomerAuthError({
      message: 'GOOGLE_CLIENT_ID is not configured.',
      statusCode: 500,
      code: 'CUSTOMER_AUTH_GOOGLE_NOT_CONFIGURED',
    });
  }

  if (!idToken) {
    throw new CustomerAuthError({
      message: 'Google ID token is required.',
      statusCode: 400,
      code: 'CUSTOMER_AUTH_GOOGLE_TOKEN_REQUIRED',
    });
  }

  try {
    const { payload } = await jwtVerify(String(idToken), googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: customerAuthConfig.googleClientId,
    });

    if (!payload.email || payload.email_verified !== true) {
      throw new CustomerAuthError({
        message: 'Google account email is not verified.',
        statusCode: 401,
        code: 'CUSTOMER_AUTH_GOOGLE_EMAIL_NOT_VERIFIED',
      });
    }

    return {
      googleId: String(payload.sub || ''),
      email: String(payload.email || '').toLowerCase(),
      customerName: String(payload.name || '').trim(),
      avatarUrl: String(payload.picture || '').trim(),
      emailVerified: Boolean(payload.email_verified),
    };
  } catch (error) {
    if (error instanceof CustomerAuthError) {
      throw error;
    }

    throw new CustomerAuthError({
      message: 'Google identity token is invalid.',
      statusCode: 401,
      code: 'CUSTOMER_AUTH_GOOGLE_TOKEN_INVALID',
    });
  }
}
