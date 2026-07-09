import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VerificationTokenService,
  VERIFICATION_OTP_MAX_RESENDS,
} from '../lib/verification-token/service.js';

function createVerificationTokenStore() {
  let token = null;

  const prismaClient = {
    verificationToken: {
      deleteMany: async ({ where }) => {
        if (!token) {
          return { count: 0 };
        }

        const expiresAt = where.expiresAt?.lt;
        if (expiresAt && token.expiresAt < expiresAt) {
          token = null;
          return { count: 1 };
        }

        if (where.type && where.identifier && token.type === where.type && token.identifier === where.identifier) {
          token = null;
          return { count: 1 };
        }

        return { count: 0 };
      },
      findUnique: async ({ where }) => {
        if (!token) {
          return null;
        }

        return token.type === where.type_identifier.type && token.identifier === where.type_identifier.identifier
          ? token
          : null;
      },
      create: async ({ data }) => {
        token = {
          id: 'verification-token-1',
          ...data,
          createdAt: new Date('2026-07-09T10:00:00.000Z'),
          updatedAt: new Date('2026-07-09T10:00:00.000Z'),
        };
        return token;
      },
      update: async ({ where, data }) => {
        token = {
          ...token,
          ...data,
          id: where.id,
          updatedAt: new Date('2026-07-09T10:01:00.000Z'),
        };
        return token;
      },
      delete: async ({ where }) => {
        if (token?.id === where.id) {
          token = null;
        }
        return { count: 1 };
      },
    },
  };

  return {
    prismaClient,
    getToken: () => token,
  };
}

test('creates a verification token with an OTP and payload', async () => {
  const store = createVerificationTokenStore();
  const service = new VerificationTokenService({
    prismaClient: store.prismaClient,
    nowFactory: () => new Date('2026-07-09T10:00:00.000Z'),
  });

  const result = await service.createVerificationToken({
    type: 'REGISTER',
    identifier: 'john@example.com',
    payload: { customerName: 'John Doe' },
  });

  assert.match(result.otp, /^\d{6}$/);
  assert.equal(result.verificationToken.identifier, 'john@example.com');
  assert.deepEqual(result.verificationToken.payload, { customerName: 'John Doe' });
  assert.ok(store.getToken());
});

test('resends a verification token and increases resendCount', async () => {
  const store = createVerificationTokenStore();
  const service = new VerificationTokenService({
    prismaClient: store.prismaClient,
    nowFactory: () => new Date('2026-07-09T10:00:00.000Z'),
  });

  await service.createVerificationToken({
    type: 'REGISTER',
    identifier: 'john@example.com',
    payload: { customerName: 'John Doe' },
  });

  const resendService = new VerificationTokenService({
    prismaClient: store.prismaClient,
    nowFactory: () => new Date('2026-07-09T10:01:01.000Z'),
  });

  const resent = await resendService.resendVerificationToken({
    type: 'REGISTER',
    identifier: 'john@example.com',
  });

  assert.match(resent.otp, /^\d{6}$/);
  assert.equal(resent.verificationToken.resendCount, 1);
});

test('rejects resend when the limit is exceeded', async () => {
  const store = createVerificationTokenStore();
  const service = new VerificationTokenService({
    prismaClient: store.prismaClient,
    nowFactory: () => new Date('2026-07-09T10:00:00.000Z'),
  });

  await service.createVerificationToken({
    type: 'REGISTER',
    identifier: 'john@example.com',
    payload: { customerName: 'John Doe' },
  });

  store.getToken().resendCount = VERIFICATION_OTP_MAX_RESENDS;

  await assert.rejects(
    service.resendVerificationToken({
      type: 'REGISTER',
      identifier: 'john@example.com',
    }),
    (error) => error.code === 'VERIFICATION_TOKEN_RESEND_LIMIT_REACHED',
  );
});

test('increments attempts when an invalid OTP is submitted', async () => {
  const store = createVerificationTokenStore();
  const service = new VerificationTokenService({
    prismaClient: store.prismaClient,
    nowFactory: () => new Date('2026-07-09T10:00:00.000Z'),
  });

  const created = await service.createVerificationToken({
    type: 'REGISTER',
    identifier: 'john@example.com',
    payload: { customerName: 'John Doe' },
  });

  await assert.rejects(
    service.verifyOtp({
      type: 'REGISTER',
      identifier: 'john@example.com',
      otp: created.otp === '000000' ? '111111' : '000000',
    }),
    (error) => error.code === 'VERIFICATION_TOKEN_INVALID',
  );

  assert.equal(store.getToken().attempts, 1);
});

test('verifies a valid OTP successfully', async () => {
  const store = createVerificationTokenStore();
  const service = new VerificationTokenService({
    prismaClient: store.prismaClient,
    nowFactory: () => new Date('2026-07-09T10:00:00.000Z'),
  });

  const created = await service.createVerificationToken({
    type: 'REGISTER',
    identifier: 'john@example.com',
    payload: { customerName: 'John Doe' },
  });

  const verified = await service.verifyOtp({
    type: 'REGISTER',
    identifier: 'john@example.com',
    otp: created.otp,
  });

  assert.equal(verified.identifier, 'john@example.com');
});
