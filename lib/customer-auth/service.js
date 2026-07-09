import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/email/service';
import { CUSTOMER_AUTH_PROVIDER } from './constants';
import { CustomerAuthError } from './errors';
import { logCustomerAuthAudit } from './audit';
import { generateCustomerCode } from './customer-number';
import { compareCustomerPassword, hashCustomerPassword, validateStrongPassword } from './password';
import { buildPasswordResetUrl, generatePasswordResetToken, hashPasswordResetToken } from './password-reset';
import {
  decodeCustomerJwtPayload,
  hashRefreshToken,
  issueCustomerAccessToken,
  issueCustomerRefreshToken,
  verifyCustomerAccessToken,
  verifyCustomerRefreshToken,
} from './tokens';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function normalizeCustomerName(customerName) {
  return String(customerName || '').trim();
}

function isValidEmailAddress(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function buildTokenFingerprint(token) {
  const hash = hashPasswordResetToken(token);
  return hash ? hash.slice(0, 12) : '';
}

function extractIpAddress(request) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const firstForwarded = forwardedFor.split(',').map((value) => value.trim()).filter(Boolean)[0];
  const realIp = request.headers.get('x-real-ip') || '';
  return firstForwarded || realIp || '';
}

function detectBrowser(userAgent) {
  const value = String(userAgent || '').toLowerCase();

  if (value.includes('edg/')) return 'Edge';
  if (value.includes('chrome/')) return 'Chrome';
  if (value.includes('safari/') && !value.includes('chrome/')) return 'Safari';
  if (value.includes('firefox/')) return 'Firefox';
  if (value.includes('opr/') || value.includes('opera/')) return 'Opera';

  return 'Unknown Browser';
}

function detectDevice(userAgent, fallbackDevice = '') {
  if (fallbackDevice) {
    return String(fallbackDevice).trim();
  }

  const value = String(userAgent || '').toLowerCase();

  if (value.includes('iphone')) return 'iPhone';
  if (value.includes('ipad')) return 'iPad';
  if (value.includes('android')) return 'Android';
  if (value.includes('macintosh') || value.includes('windows') || value.includes('linux')) return 'Desktop';

  return 'Unknown Device';
}

function buildSessionContext({ request, device = '' }) {
  const userAgent = request.headers.get('user-agent') || '';

  return {
    ipAddress: extractIpAddress(request),
    userAgent,
    browser: detectBrowser(userAgent),
    device: detectDevice(userAgent, device),
  };
}

function buildCustomerResponse(customer) {
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    customerName: customer.customerName,
    email: customer.email || '',
    phone: customer.phone || '',
    avatarUrl: customer.avatarUrl || '',
    emailVerified: Boolean(customer.emailVerified),
    authProvider: customer.authProvider || CUSTOMER_AUTH_PROVIDER.LOCAL,
    lastLoginAt: customer.lastLoginAt || null,
    provinceId: customer.provinceId || '',
    province: customer.province || '',
    cityId: customer.cityId || '',
    city: customer.city || '',
    districtId: customer.districtId || '',
    district: customer.district || '',
    postalCode: customer.postalCode || '',
    streetAddress: customer.streetAddress || '',
    country: customer.country || 'Indonesia',
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

async function ensureUniqueRegisterIdentity(prismaClient, email, phone) {
  const existingByEmail = await prismaClient.customer.findUnique({
    where: { email },
  });

  if (existingByEmail) {
    throw new CustomerAuthError({
      message: 'An account with this email already exists.',
      statusCode: 409,
      code: 'CUSTOMER_AUTH_EMAIL_ALREADY_EXISTS',
    });
  }

  if (phone) {
    const existingByPhone = await prismaClient.customer.findUnique({
      where: { phone },
    });

    if (existingByPhone) {
      throw new CustomerAuthError({
        message: 'An account with this phone number already exists.',
        statusCode: 409,
        code: 'CUSTOMER_AUTH_PHONE_ALREADY_EXISTS',
      });
    }
  }
}

export async function createCustomerSession(prismaClient, { customer, request, device = '' }) {
  const sessionId = uuid();
  const refreshToken = await issueCustomerRefreshToken({
    customerId: customer.id,
    sessionId,
  });
  const accessToken = await issueCustomerAccessToken({
    customer,
    sessionId,
  });
  const sessionContext = buildSessionContext({ request, device });

  await prismaClient.customerSession.create({
    data: {
      id: sessionId,
      customerId: customer.id,
      refreshTokenHash: hashRefreshToken(refreshToken.token),
      device: sessionContext.device,
      browser: sessionContext.browser,
      ipAddress: sessionContext.ipAddress,
      userAgent: sessionContext.userAgent,
      expiresAt: refreshToken.expiresAt,
      lastUsedAt: new Date(),
    },
  });

  const updatedCustomer = await prismaClient.customer.update({
    where: { id: customer.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    customer: buildCustomerResponse(updatedCustomer),
    accessToken: accessToken.token,
    refreshToken: refreshToken.token,
    accessTokenExpiresAt: accessToken.expiresAt,
    refreshTokenExpiresAt: refreshToken.expiresAt,
  };
}

async function getActiveSession(prismaClient, sessionId) {
  const session = await prismaClient.customerSession.findUnique({
    where: { id: sessionId },
    include: { customer: true },
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    throw new CustomerAuthError({
      message: 'Customer session is invalid or expired.',
      statusCode: 401,
      code: 'CUSTOMER_AUTH_SESSION_INVALID',
    });
  }

  return session;
}

function extractBearerToken(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return authorization.slice(7).trim();
}

async function revokeCustomerSession(prismaClient, sessionId) {
  await prismaClient.customerSession.updateMany({
    where: {
      id: sessionId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

async function revokeAllCustomerSessions(prismaClient, customerId, exceptSessionId = '') {
  await prismaClient.customerSession.updateMany({
    where: {
      customerId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export class CustomerAuthService {
  constructor({
    prismaClient = prisma,
    emailClient = emailService,
  } = {}) {
    this.prisma = prismaClient;
    this.emailService = emailClient;
  }

  async register({
    customerName,
    email,
    phone,
    password,
    request,
    device = '',
  }) {
    const normalizedCustomerName = normalizeCustomerName(customerName);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const normalizedPassword = String(password || '');

    if (!normalizedCustomerName) {
      throw new CustomerAuthError({
        message: 'Full Name is required.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_NAME_REQUIRED',
      });
    }

    if (!normalizedEmail) {
      throw new CustomerAuthError({
        message: 'Email is required.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_EMAIL_REQUIRED',
      });
    }

    if (!normalizedPhone) {
      throw new CustomerAuthError({
        message: 'Phone is required.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_PHONE_REQUIRED',
      });
    }

    if (!normalizedPassword) {
      throw new CustomerAuthError({
        message: 'Password is required.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_PASSWORD_REQUIRED',
      });
    }

    validateStrongPassword(normalizedPassword);
    await ensureUniqueRegisterIdentity(this.prisma, normalizedEmail, normalizedPhone);

    const passwordHash = await hashCustomerPassword(normalizedPassword);
    const customerCode = await generateCustomerCode(this.prisma);

    const customer = await this.prisma.customer.create({
      data: {
        id: uuid(),
        customerCode,
        customerName: normalizedCustomerName,
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        emailVerified: false,
        authProvider: CUSTOMER_AUTH_PROVIDER.LOCAL,
        status: 'Active',
      },
    });

    return createCustomerSession(this.prisma, {
      customer,
      request,
      device,
    });
  }

  async login({ email, password, request, device = '' }) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = String(password || '');

    if (!normalizedEmail || !normalizedPassword) {
      throw new CustomerAuthError({
        message: 'Email and password are required.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_CREDENTIALS_REQUIRED',
      });
    }

    const customer = await this.prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });

    if (!customer || !await compareCustomerPassword(normalizedPassword, customer.passwordHash)) {
      throw new CustomerAuthError({
        message: 'Invalid email or password.',
        statusCode: 401,
        code: 'CUSTOMER_AUTH_INVALID_CREDENTIALS',
      });
    }

    return createCustomerSession(this.prisma, {
      customer,
      request,
      device,
    });
  }



  async refresh({ refreshToken, request, device = '' }) {
    if (!refreshToken) {
      throw new CustomerAuthError({
        message: 'Refresh token is required.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_REFRESH_TOKEN_REQUIRED',
      });
    }

    const payload = await verifyCustomerRefreshToken(refreshToken);
    const sessionId = String(payload.jti || '');
    const customerId = String(payload.sub || '');
    const session = await getActiveSession(this.prisma, sessionId);

    if (session.customerId !== customerId || session.refreshTokenHash !== hashRefreshToken(refreshToken)) {
      await revokeCustomerSession(this.prisma, sessionId);
      throw new CustomerAuthError({
        message: 'Refresh token is invalid.',
        statusCode: 401,
        code: 'CUSTOMER_AUTH_REFRESH_TOKEN_INVALID',
      });
    }

    const nextRefreshToken = await issueCustomerRefreshToken({
      customerId,
      sessionId,
    });
    const nextAccessToken = await issueCustomerAccessToken({
      customer: session.customer,
      sessionId,
    });
    const sessionContext = buildSessionContext({ request, device });

    await this.prisma.customerSession.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: hashRefreshToken(nextRefreshToken.token),
        expiresAt: nextRefreshToken.expiresAt,
        lastUsedAt: new Date(),
        device: sessionContext.device || session.device,
        browser: sessionContext.browser || session.browser,
        ipAddress: sessionContext.ipAddress || session.ipAddress,
        userAgent: sessionContext.userAgent || session.userAgent,
      },
    });

    const updatedCustomer = await this.prisma.customer.update({
      where: { id: customerId },
      data: { lastLoginAt: new Date() },
    });

    return {
      customer: buildCustomerResponse(updatedCustomer),
      accessToken: nextAccessToken.token,
      refreshToken: nextRefreshToken.token,
      accessTokenExpiresAt: nextAccessToken.expiresAt,
      refreshTokenExpiresAt: nextRefreshToken.expiresAt,
    };
  }

  async getAuthenticatedCustomer({ accessToken }) {
    if (!accessToken) {
      throw new CustomerAuthError({
        message: 'Access token is required.',
        statusCode: 401,
        code: 'CUSTOMER_AUTH_ACCESS_TOKEN_REQUIRED',
      });
    }

    const payload = await verifyCustomerAccessToken(accessToken);
    const sessionId = String(payload.jti || '');
    const customerId = String(payload.sub || '');
    const session = await getActiveSession(this.prisma, sessionId);

    if (session.customerId !== customerId) {
      throw new CustomerAuthError({
        message: 'Customer session is invalid.',
        statusCode: 401,
        code: 'CUSTOMER_AUTH_SESSION_INVALID',
      });
    }

    return {
      customer: buildCustomerResponse(session.customer),
      session: {
        id: session.id,
        customerId: session.customerId,
        device: session.device,
        browser: session.browser,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        expiresAt: session.expiresAt,
        lastUsedAt: session.lastUsedAt,
        createdAt: session.createdAt,
      },
    };
  }

  async logout({ accessToken = '', refreshToken = '' }) {
    let sessionId = '';

    if (refreshToken) {
      const payload = await verifyCustomerRefreshToken(refreshToken);
      sessionId = String(payload.jti || '');
    } else if (accessToken) {
      const payload = await verifyCustomerAccessToken(accessToken);
      sessionId = String(payload.jti || '');
    } else {
      throw new CustomerAuthError({
        message: 'Access token or refresh token is required.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_LOGOUT_TOKEN_REQUIRED',
      });
    }

    await revokeCustomerSession(this.prisma, sessionId);

    return { ok: true };
  }

  async logoutAll({ accessToken }) {
    if (!accessToken) {
      throw new CustomerAuthError({
        message: 'Access token is required.',
        statusCode: 401,
        code: 'CUSTOMER_AUTH_ACCESS_TOKEN_REQUIRED',
      });
    }

    const payload = await verifyCustomerAccessToken(accessToken);
    const customerId = String(payload.sub || '');
    const currentSessionId = String(payload.jti || '');

    await getActiveSession(this.prisma, currentSessionId);
    await revokeAllCustomerSessions(this.prisma, customerId);

    return { ok: true };
  }

  async changePassword({ accessToken, currentPassword, newPassword }) {
    if (!accessToken) {
      throw new CustomerAuthError({
        message: 'Access token is required.',
        statusCode: 401,
        code: 'CUSTOMER_AUTH_ACCESS_TOKEN_REQUIRED',
      });
    }

    if (!currentPassword || !newPassword) {
      throw new CustomerAuthError({
        message: 'Current password and new password are required.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_PASSWORD_CHANGE_FIELDS_REQUIRED',
      });
    }

    validateStrongPassword(newPassword);

    const payload = await verifyCustomerAccessToken(accessToken);
    const customerId = String(payload.sub || '');
    const currentSessionId = String(payload.jti || '');
    const session = await getActiveSession(this.prisma, currentSessionId);

    if (!await compareCustomerPassword(String(currentPassword), session.customer.passwordHash)) {
      throw new CustomerAuthError({
        message: 'Current password is incorrect.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_CURRENT_PASSWORD_INVALID',
      });
    }

    const passwordHash = await hashCustomerPassword(String(newPassword));

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          passwordHash,
        },
      });

      await revokeAllCustomerSessions(tx, customerId, currentSessionId);
      await tx.customerSession.update({
        where: { id: currentSessionId },
        data: {
          lastUsedAt: new Date(),
        },
      });
    });

    return { ok: true };
  }

  async forgotPassword({ email, request }) {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      throw new CustomerAuthError({
        message: 'Email is required.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_EMAIL_REQUIRED',
      });
    }

    if (!isValidEmailAddress(normalizedEmail)) {
      throw new CustomerAuthError({
        message: 'Enter a valid email address.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_EMAIL_INVALID',
      });
    }

    const customer = await this.prisma.customer.findUnique({
      where: { email: normalizedEmail },
    });

    logCustomerAuthAudit('PASSWORD_RESET_REQUESTED', {
      email: normalizedEmail,
      customerId: customer?.id || '',
      customerFound: Boolean(customer),
      ipAddress: extractIpAddress(request),
    });

    if (!customer?.email) {
      return {
        ok: true,
        message: 'If an account with that email exists, password reset instructions have been sent.',
      };
    }

    const passwordResetToken = generatePasswordResetToken();

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        passwordResetToken: passwordResetToken.tokenHash,
        passwordResetTokenExpiresAt: passwordResetToken.expiresAt,
      },
    });

    try {
      await this.emailService.sendPasswordResetEmail({
        to: customer.email,
        customerName: customer.customerName || 'Customer',
        resetUrl: buildPasswordResetUrl(passwordResetToken.token),
      });
    } catch (error) {
      console.error('[customer-auth-password-reset-email]', JSON.stringify({
        eventName: 'PASSWORD_RESET_EMAIL_FAILED',
        timestamp: new Date().toISOString(),
        customerId: customer.id,
        email: normalizedEmail,
        message: error instanceof Error ? error.message : 'Unknown email delivery error.',
      }));
    }

    return {
      ok: true,
      message: 'If an account with that email exists, password reset instructions have been sent.',
    };
  }

  async resetPassword({ token, password, confirmPassword, request }) {
    const normalizedToken = String(token || '').trim();
    const normalizedPassword = String(password || '');
    const normalizedConfirmPassword = String(confirmPassword || '');
    const ipAddress = extractIpAddress(request);

    if (!normalizedToken) {
      logCustomerAuthAudit('PASSWORD_RESET_INVALID_TOKEN', {
        tokenFingerprint: buildTokenFingerprint(token),
        ipAddress,
      });

      throw new CustomerAuthError({
        message: 'Password reset token is required.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_PASSWORD_RESET_TOKEN_REQUIRED',
      });
    }

    if (!normalizedPassword || !normalizedConfirmPassword) {
      throw new CustomerAuthError({
        message: 'Password and confirm password are required.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_PASSWORD_RESET_FIELDS_REQUIRED',
      });
    }

    if (normalizedPassword !== normalizedConfirmPassword) {
      throw new CustomerAuthError({
        message: 'Confirm password must match the password.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_PASSWORD_CONFIRMATION_MISMATCH',
      });
    }

    validateStrongPassword(normalizedPassword);

    const passwordResetTokenHash = hashPasswordResetToken(normalizedToken);
    const customer = await this.prisma.customer.findFirst({
      where: {
        passwordResetToken: passwordResetTokenHash,
      },
    });

    if (!customer) {
      logCustomerAuthAudit('PASSWORD_RESET_INVALID_TOKEN', {
        tokenFingerprint: buildTokenFingerprint(normalizedToken),
        ipAddress,
      });

      throw new CustomerAuthError({
        message: 'Password reset token is invalid.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_PASSWORD_RESET_TOKEN_INVALID',
      });
    }

    if (!customer.passwordResetTokenExpiresAt || customer.passwordResetTokenExpiresAt.getTime() <= Date.now()) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          passwordResetToken: null,
          passwordResetTokenExpiresAt: null,
        },
      });

      logCustomerAuthAudit('PASSWORD_RESET_EXPIRED', {
        customerId: customer.id,
        email: customer.email || '',
        ipAddress,
      });

      throw new CustomerAuthError({
        message: 'Password reset token has expired.',
        statusCode: 400,
        code: 'CUSTOMER_AUTH_PASSWORD_RESET_TOKEN_EXPIRED',
      });
    }

    const passwordHash = await hashCustomerPassword(normalizedPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetTokenExpiresAt: null,
        },
      });

      await revokeAllCustomerSessions(tx, customer.id);
    });

    logCustomerAuthAudit('PASSWORD_RESET_COMPLETED', {
      customerId: customer.id,
      email: customer.email || '',
      ipAddress,
    });

    return { ok: true };
  }

  async authenticateRequest(request, { optional = false } = {}) {
    const accessToken = extractBearerToken(request);

    if (!accessToken) {
      if (optional) {
        return null;
      }

      throw new CustomerAuthError({
        message: 'Access token is required.',
        statusCode: 401,
        code: 'CUSTOMER_AUTH_ACCESS_TOKEN_REQUIRED',
      });
    }

    const payload = await verifyCustomerAccessToken(accessToken);
    const sessionId = String(payload.jti || '');
    const customerId = String(payload.sub || '');
    const session = await getActiveSession(this.prisma, sessionId);

    if (session.customerId !== customerId) {
      throw new CustomerAuthError({
        message: 'Customer session is invalid.',
        statusCode: 401,
        code: 'CUSTOMER_AUTH_SESSION_INVALID',
      });
    }

    return {
      accessToken,
      payload,
      customer: session.customer,
      session,
    };
  }

  getJwtPayload(token) {
    return decodeCustomerJwtPayload(token);
  }
}

export const customerAuthService = new CustomerAuthService();
