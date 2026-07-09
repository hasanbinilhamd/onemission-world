import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { CustomerAuthError } from '@/lib/customer-auth/errors';

export const VERIFICATION_OTP_DIGITS = 6;
export const VERIFICATION_OTP_TTL_MS = 10 * 60 * 1000;
export const VERIFICATION_OTP_MAX_ATTEMPTS = 5;
export const VERIFICATION_OTP_MAX_RESENDS = 5;
export const VERIFICATION_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

function normalizeIdentifier(identifier) {
  return String(identifier || '').trim().toLowerCase();
}

function generateOtp() {
  return String(crypto.randomInt(0, 10 ** VERIFICATION_OTP_DIGITS)).padStart(VERIFICATION_OTP_DIGITS, '0');
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp || '')).digest('hex');
}

function compareOtpHash(otp, otpHash) {
  const left = Buffer.from(hashOtp(otp), 'hex');
  const right = Buffer.from(String(otpHash || ''), 'hex');

  if (left.length !== right.length || left.length === 0) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function buildExpiresAt(now = new Date()) {
  return new Date(now.getTime() + VERIFICATION_OTP_TTL_MS);
}

function buildResendAvailableAt(expiresAt) {
  return new Date(new Date(expiresAt).getTime() - VERIFICATION_OTP_TTL_MS + VERIFICATION_OTP_RESEND_COOLDOWN_MS);
}

export class VerificationTokenService {
  constructor({ prismaClient = prisma, nowFactory = () => new Date() } = {}) {
    this.prisma = prismaClient;
    this.nowFactory = nowFactory;
  }

  async deleteExpiredVerificationTokens({ type = undefined, identifier = undefined } = {}) {
    const where = {
      expiresAt: {
        lt: this.nowFactory(),
      },
      ...(type ? { type } : {}),
      ...(identifier ? { identifier: normalizeIdentifier(identifier) } : {}),
    };

    return this.prisma.verificationToken.deleteMany({ where });
  }

  async getVerificationToken({ type, identifier }) {
    return this.prisma.verificationToken.findUnique({
      where: {
        type_identifier: {
          type,
          identifier: normalizeIdentifier(identifier),
        },
      },
    });
  }

  async createVerificationToken({ type, identifier, payload = null }) {
    const normalizedIdentifier = normalizeIdentifier(identifier);
    const now = this.nowFactory();
    const otp = generateOtp();
    const expiresAt = buildExpiresAt(now);

    await this.deleteExpiredVerificationTokens({ type, identifier: normalizedIdentifier });
    await this.prisma.verificationToken.deleteMany({
      where: {
        type,
        identifier: normalizedIdentifier,
      },
    });

    const verificationToken = await this.prisma.verificationToken.create({
      data: {
        type,
        identifier: normalizedIdentifier,
        otpHash: hashOtp(otp),
        payload,
        expiresAt,
        attempts: 0,
        resendCount: 0,
        verifiedAt: null,
      },
    });

    return {
      verificationToken,
      otp,
      expiresAt,
      resendAvailableAt: buildResendAvailableAt(expiresAt),
    };
  }

  async resendVerificationToken({ type, identifier, payload = undefined }) {
    const verificationToken = await this.getVerificationToken({ type, identifier });
    const now = this.nowFactory();

    if (!verificationToken || verificationToken.verifiedAt) {
      throw new CustomerAuthError({
        message: 'Verification request was not found.',
        statusCode: 404,
        code: 'VERIFICATION_TOKEN_NOT_FOUND',
      });
    }

    if (verificationToken.expiresAt.getTime() <= now.getTime()) {
      await this.prisma.verificationToken.delete({ where: { id: verificationToken.id } });
      throw new CustomerAuthError({
        message: 'Verification code has expired. Please register again.',
        statusCode: 400,
        code: 'VERIFICATION_TOKEN_EXPIRED',
      });
    }

    if (verificationToken.resendCount >= VERIFICATION_OTP_MAX_RESENDS) {
      throw new CustomerAuthError({
        message: 'Resend limit reached. Please register again.',
        statusCode: 429,
        code: 'VERIFICATION_TOKEN_RESEND_LIMIT_REACHED',
      });
    }

    const resendAvailableAt = buildResendAvailableAt(verificationToken.expiresAt);
    if (resendAvailableAt.getTime() > now.getTime()) {
      throw new CustomerAuthError({
        message: 'Please wait before requesting another verification code.',
        statusCode: 429,
        code: 'VERIFICATION_TOKEN_RESEND_COOLDOWN',
      });
    }

    const otp = generateOtp();
    const expiresAt = buildExpiresAt(now);
    const updatedToken = await this.prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: {
        otpHash: hashOtp(otp),
        payload: payload === undefined ? verificationToken.payload : payload,
        expiresAt,
        attempts: 0,
        resendCount: verificationToken.resendCount + 1,
        verifiedAt: null,
      },
    });

    return {
      verificationToken: updatedToken,
      otp,
      expiresAt,
      resendAvailableAt: buildResendAvailableAt(expiresAt),
    };
  }

  async verifyOtp({ type, identifier, otp }) {
    const verificationToken = await this.getVerificationToken({ type, identifier });
    const now = this.nowFactory();

    if (!verificationToken || verificationToken.verifiedAt) {
      throw new CustomerAuthError({
        message: 'Verification code is invalid.',
        statusCode: 400,
        code: 'VERIFICATION_TOKEN_INVALID',
      });
    }

    if (verificationToken.expiresAt.getTime() <= now.getTime()) {
      await this.prisma.verificationToken.delete({ where: { id: verificationToken.id } });
      throw new CustomerAuthError({
        message: 'Verification code has expired. Please register again.',
        statusCode: 400,
        code: 'VERIFICATION_TOKEN_EXPIRED',
      });
    }

    if (verificationToken.attempts >= VERIFICATION_OTP_MAX_ATTEMPTS) {
      throw new CustomerAuthError({
        message: 'Too many invalid verification attempts. Please request a new code.',
        statusCode: 429,
        code: 'VERIFICATION_TOKEN_ATTEMPTS_EXCEEDED',
      });
    }

    if (!compareOtpHash(otp, verificationToken.otpHash)) {
      await this.prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: {
          attempts: verificationToken.attempts + 1,
        },
      });

      throw new CustomerAuthError({
        message: 'Verification code is invalid.',
        statusCode: 400,
        code: 'VERIFICATION_TOKEN_INVALID',
      });
    }

    return verificationToken;
  }

  async deleteVerificationToken(tokenId) {
    if (!tokenId) {
      return { count: 0 };
    }

    await this.prisma.verificationToken.delete({
      where: { id: tokenId },
    });

    return { count: 1 };
  }
}

export const verificationTokenService = new VerificationTokenService();
