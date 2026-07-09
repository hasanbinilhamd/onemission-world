import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { customerAuthConfig } from '../config';
import { CUSTOMER_AUTH_PROVIDER } from '../constants';
import { generateCustomerCode } from '../customer-number';
import { CustomerAuthError } from '../errors';
import { createCustomerSession } from '../service';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeCustomerName(customerName, fallbackEmail = '') {
  return String(customerName || '').trim() || normalizeEmail(fallbackEmail);
}

export async function verifyGoogleIdentityToken(idToken) {
  if (!customerAuthConfig.googleClientId) {
    throw new CustomerAuthError({
      message: 'Google login is not configured.',
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

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(idToken))}`, {
    method: 'GET',
    cache: 'no-store',
  }).catch(() => null);

  if (!response || !response.ok) {
    throw new CustomerAuthError({
      message: 'Google identity token is invalid.',
      statusCode: 401,
      code: 'CUSTOMER_AUTH_GOOGLE_TOKEN_INVALID',
    });
  }

  const payload = await response.json().catch(() => ({}));
  const audience = String(payload.aud || '').trim();
  const email = normalizeEmail(payload.email);
  const emailVerified = String(payload.email_verified || '').toLowerCase() === 'true';
  const issuer = String(payload.iss || '').trim();

  if (audience !== customerAuthConfig.googleClientId || !['accounts.google.com', 'https://accounts.google.com'].includes(issuer)) {
    throw new CustomerAuthError({
      message: 'Google identity token is invalid.',
      statusCode: 401,
      code: 'CUSTOMER_AUTH_GOOGLE_TOKEN_INVALID',
    });
  }

  if (!email || !emailVerified) {
    throw new CustomerAuthError({
      message: 'Google account email is not verified.',
      statusCode: 401,
      code: 'CUSTOMER_AUTH_GOOGLE_EMAIL_NOT_VERIFIED',
    });
  }

  return {
    googleId: String(payload.sub || '').trim(),
    email,
    customerName: normalizeCustomerName(payload.name, email),
    avatarUrl: String(payload.picture || '').trim(),
    emailVerified,
  };
}

export async function authenticateCustomerWithGoogle({
  idToken,
  request,
  device = '',
  prismaClient = prisma,
} = {}) {
  const googleProfile = await verifyGoogleIdentityToken(idToken);
  let customer = await prismaClient.customer.findFirst({
    where: {
      OR: [
        { googleId: googleProfile.googleId },
        { email: googleProfile.email },
      ],
    },
  });

  if (!customer) {
    const customerCode = await generateCustomerCode(prismaClient);
    customer = await prismaClient.customer.create({
      data: {
        id: uuid(),
        customerCode,
        customerName: googleProfile.customerName,
        email: googleProfile.email,
        googleId: googleProfile.googleId,
        emailVerified: googleProfile.emailVerified,
        avatarUrl: googleProfile.avatarUrl || null,
        authProvider: CUSTOMER_AUTH_PROVIDER.GOOGLE,
        customerType: 'Individual',
        status: 'Active',
      },
    });
  } else {
    customer = await prismaClient.customer.update({
      where: { id: customer.id },
      data: {
        customerName: customer.customerName || googleProfile.customerName,
        googleId: customer.googleId || googleProfile.googleId,
        emailVerified: true,
        avatarUrl: googleProfile.avatarUrl || customer.avatarUrl || null,
        authProvider: customer.passwordHash ? customer.authProvider || CUSTOMER_AUTH_PROVIDER.LOCAL : CUSTOMER_AUTH_PROVIDER.GOOGLE,
      },
    });
  }

  return createCustomerSession(prismaClient, {
    customer,
    request,
    device,
  });
}
