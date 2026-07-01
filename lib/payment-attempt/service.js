import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { checkoutService } from '@/lib/checkout';
import { paymentAttemptConfig } from './config';
import { PaymentAttemptError } from './errors';
import { MidtransProvider } from './providers/midtrans-provider';

const ACTIVE_PAYMENT_ATTEMPT_STATUSES = ['CREATED', 'PENDING'];
const SNAP_GENERATABLE_STATUSES = ['CREATED'];
const PAYMENT_ATTEMPT_STATUS_TRANSITIONS = {
  CREATED: ['CREATED', 'PENDING', 'PAID', 'EXPIRED', 'FAILED'],
  PENDING: ['PENDING', 'PAID', 'EXPIRED', 'FAILED'],
  PAID: ['PAID', 'REFUNDED'],
  EXPIRED: ['EXPIRED'],
  FAILED: ['FAILED'],
  CANCELLED: ['CANCELLED'],
  REFUNDED: ['REFUNDED'],
};

function logPaymentAttempt({
  attemptNumber = '',
  checkoutNumber = '',
  providerReference = '',
  previousStatus = '',
  newStatus = '',
  validationResult,
  durationMs,
}) {
  const payload = {
    attemptNumber,
    checkoutNumber,
    providerReference,
    previousStatus,
    newStatus,
    validationResult,
    durationMs,
  };

  if (validationResult === 'FAILED' || validationResult === 'LOCKED') {
    console.warn('[PaymentAttemptService]', payload);
    return;
  }

  console.log('[PaymentAttemptService]', payload);
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002'
    || String(error?.message || '').includes('PaymentAttempt_active_checkout_idx');
}

function isTransitionAllowed(currentStatus, nextStatus) {
  const allowedStatuses = PAYMENT_ATTEMPT_STATUS_TRANSITIONS[currentStatus] || [];
  return allowedStatuses.includes(nextStatus);
}

export class PaymentAttemptService {
  constructor({
    prismaClient = prisma,
    checkout = checkoutService,
    paymentProvider = new MidtransProvider(),
    idGenerator = uuid,
    nowFactory = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.checkoutService = checkout;
    this.paymentProvider = paymentProvider;
    this.idGenerator = idGenerator;
    this.nowFactory = nowFactory;
  }

  async generateAttemptNumber() {
    const now = this.nowFactory();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `PAY-${year}${month}-`;

    const existing = await this.prisma.paymentAttempt.findMany({
      where: { attemptNumber: { startsWith: prefix } },
      select: { attemptNumber: true },
      orderBy: { attemptNumber: 'desc' },
    });

    let maxSeq = 0;
    for (const entry of existing) {
      const parts = entry.attemptNumber.split('-');
      const seq = parseInt(parts[parts.length - 1] || '0', 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
  }

  async findActiveAttempt(checkoutSessionId) {
    return this.prisma.paymentAttempt.findFirst({
      where: {
        checkoutSessionId,
        status: { in: ACTIVE_PAYMENT_ATTEMPT_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPaymentAttemptById(paymentAttemptId) {
    if (!paymentAttemptId) {
      throw new PaymentAttemptError({
        message: 'paymentAttemptId is required.',
        statusCode: 400,
        code: 'PAYMENT_ATTEMPT_ID_REQUIRED',
      });
    }

    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { id: paymentAttemptId },
    });

    if (!attempt) {
      throw new PaymentAttemptError({
        message: 'Payment attempt was not found.',
        statusCode: 404,
        code: 'PAYMENT_ATTEMPT_NOT_FOUND',
      });
    }

    return attempt;
  }

  async getPaymentAttemptByProviderReference(providerReference) {
    if (!providerReference) {
      throw new PaymentAttemptError({
        message: 'providerReference is required.',
        statusCode: 400,
        code: 'PAYMENT_ATTEMPT_PROVIDER_REFERENCE_REQUIRED',
      });
    }

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        OR: [
          { providerReference },
          { attemptNumber: providerReference },
        ],
      },
    });

    if (!attempt) {
      throw new PaymentAttemptError({
        message: 'Payment attempt was not found.',
        statusCode: 404,
        code: 'PAYMENT_ATTEMPT_NOT_FOUND',
      });
    }

    return attempt;
  }

  validatePaymentAttemptForSnap(attempt) {
    if (attempt.snapToken) {
      return;
    }

    if (!SNAP_GENERATABLE_STATUSES.includes(attempt.status)) {
      throw new PaymentAttemptError({
        message: 'Payment attempt cannot generate Snap token with the current status.',
        statusCode: 400,
        code: 'PAYMENT_ATTEMPT_INVALID_STATUS',
      });
    }
  }

  buildPaymentAttemptResponse(attempt) {
    return {
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      checkoutSessionId: attempt.checkoutSessionId,
      provider: attempt.provider,
      providerReference: attempt.providerReference,
      providerTransactionId: attempt.providerTransactionId,
      snapToken: attempt.snapToken,
      snapRedirectUrl: attempt.snapRedirectUrl,
      status: attempt.status,
      grossAmount: attempt.grossAmount,
      currency: attempt.currency,
      expiresAt: attempt.expiresAt,
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    };
  }

  async createPaymentAttempt({ checkoutSessionId }) {
    const startedAt = Date.now();
    let attemptNumber = '';
    let checkoutNumber = '';

    try {
      if (!checkoutSessionId) {
        throw new PaymentAttemptError({
          message: 'checkoutSessionId is required.',
          statusCode: 400,
          code: 'PAYMENT_ATTEMPT_CHECKOUT_SESSION_REQUIRED',
        });
      }

      const checkoutSession = await this.checkoutService.getCheckoutSessionForPayment(checkoutSessionId);
      checkoutNumber = checkoutSession.checkoutNumber || '';

      const existingAttempt = await this.findActiveAttempt(checkoutSessionId);
      if (existingAttempt) {
        logPaymentAttempt({
          attemptNumber: existingAttempt.attemptNumber,
          checkoutNumber,
          providerReference: existingAttempt.providerReference,
          previousStatus: existingAttempt.status,
          newStatus: existingAttempt.status,
          validationResult: 'REUSED',
          durationMs: Date.now() - startedAt,
        });
        return this.buildPaymentAttemptResponse(existingAttempt);
      }

      attemptNumber = await this.generateAttemptNumber();
      const expiresAt = new Date(checkoutSession.expiresAt);

      const attempt = await this.prisma.paymentAttempt.create({
        data: {
          id: this.idGenerator(),
          attemptNumber,
          checkoutSessionId,
          provider: paymentAttemptConfig.provider,
          providerReference: '',
          providerTransactionId: '',
          snapToken: '',
          snapRedirectUrl: '',
          status: 'CREATED',
          grossAmount: checkoutSession.totals?.grandTotal ?? checkoutSession.grandTotal,
          currency: checkoutSession.currency,
          expiresAt,
        },
      });

      logPaymentAttempt({
        attemptNumber: attempt.attemptNumber,
        checkoutNumber,
        providerReference: attempt.providerReference,
        previousStatus: '',
        newStatus: attempt.status,
        validationResult: 'CREATED',
        durationMs: Date.now() - startedAt,
      });

      return this.buildPaymentAttemptResponse(attempt);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existingAttempt = await this.findActiveAttempt(checkoutSessionId);
        if (existingAttempt) {
          logPaymentAttempt({
            attemptNumber: existingAttempt.attemptNumber,
            checkoutNumber,
            providerReference: existingAttempt.providerReference,
            previousStatus: existingAttempt.status,
            newStatus: existingAttempt.status,
            validationResult: 'REUSED',
            durationMs: Date.now() - startedAt,
          });
          return this.buildPaymentAttemptResponse(existingAttempt);
        }
      }

      logPaymentAttempt({
        attemptNumber,
        checkoutNumber,
        providerReference: '',
        previousStatus: '',
        newStatus: '',
        validationResult: 'FAILED',
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  async generateSnapToken({ paymentAttemptId }) {
    const startedAt = Date.now();
    let attemptNumber = '';
    let checkoutNumber = '';

    try {
      const attempt = await this.getPaymentAttemptById(paymentAttemptId);
      attemptNumber = attempt.attemptNumber;
      this.validatePaymentAttemptForSnap(attempt);

      const checkoutSession = await this.checkoutService.getCheckoutSessionForPayment(attempt.checkoutSessionId);
      checkoutNumber = checkoutSession.checkoutNumber || '';

      if (attempt.snapToken) {
        logPaymentAttempt({
          attemptNumber,
          checkoutNumber,
          providerReference: attempt.providerReference,
          previousStatus: attempt.status,
          newStatus: attempt.status,
          validationResult: 'REUSED',
          durationMs: Date.now() - startedAt,
        });
        return this.buildPaymentAttemptResponse(attempt);
      }

      const providerReference = attempt.providerReference || attempt.attemptNumber;
      const providerResult = await this.paymentProvider.createPaymentSession({
        paymentAttempt: {
          ...attempt,
          providerReference,
        },
        checkoutSession,
      });

      const updatedAttempt = await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          providerReference: providerResult.providerReference || providerReference,
          providerTransactionId: providerResult.providerTransactionId || '',
          snapToken: providerResult.snapToken || '',
          snapRedirectUrl: providerResult.snapRedirectUrl || '',
          status: 'PENDING',
        },
      });

      logPaymentAttempt({
        attemptNumber: updatedAttempt.attemptNumber,
        checkoutNumber,
        providerReference: updatedAttempt.providerReference,
        previousStatus: attempt.status,
        newStatus: updatedAttempt.status,
        validationResult: 'SNAP_CREATED',
        durationMs: Date.now() - startedAt,
      });

      return this.buildPaymentAttemptResponse(updatedAttempt);
    } catch (error) {
      logPaymentAttempt({
        attemptNumber,
        checkoutNumber,
        providerReference: '',
        previousStatus: '',
        newStatus: '',
        validationResult: 'FAILED',
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  async onPaymentConfirmed() {
    // Reserved extension point for the next sprint.
  }

  async handleMidtransNotification(payload) {
    const startedAt = Date.now();
    let attemptNumber = '';
    let checkoutNumber = '';
    let providerReference = '';
    let previousStatus = '';
    let nextStatus = '';

    try {
      await this.paymentProvider.verifyNotificationSignature(payload);
      const normalizedNotification = await this.paymentProvider.normalizeNotification(payload);
      providerReference = normalizedNotification.providerReference;
      nextStatus = normalizedNotification.internalStatus;

      const attempt = await this.getPaymentAttemptByProviderReference(providerReference);
      attemptNumber = attempt.attemptNumber;
      previousStatus = attempt.status;

      if (previousStatus === nextStatus) {
        logPaymentAttempt({
          attemptNumber,
          checkoutNumber,
          providerReference,
          previousStatus,
          newStatus: nextStatus,
          validationResult: 'REUSED',
          durationMs: Date.now() - startedAt,
        });
        return this.buildPaymentAttemptResponse(attempt);
      }

      if (!isTransitionAllowed(previousStatus, nextStatus)) {
        throw new PaymentAttemptError({
          message: 'Payment attempt cannot transition to the requested status.',
          statusCode: 409,
          code: 'PAYMENT_ATTEMPT_INVALID_TRANSITION',
        });
      }

      const checkoutSession = await this.checkoutService.getCheckoutSessionForPayment(attempt.checkoutSessionId);
      checkoutNumber = checkoutSession.checkoutNumber || '';

      const updatedAttempt = await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          providerReference: normalizedNotification.providerReference || attempt.providerReference,
          providerTransactionId: normalizedNotification.providerTransactionId || attempt.providerTransactionId,
          status: nextStatus,
        },
      });

      if (nextStatus === 'PAID') {
        await this.onPaymentConfirmed(updatedAttempt);
      }

      logPaymentAttempt({
        attemptNumber: updatedAttempt.attemptNumber,
        checkoutNumber,
        providerReference,
        previousStatus,
        newStatus: updatedAttempt.status,
        validationResult: 'CONFIRMED',
        durationMs: Date.now() - startedAt,
      });

      return this.buildPaymentAttemptResponse(updatedAttempt);
    } catch (error) {
      logPaymentAttempt({
        attemptNumber,
        checkoutNumber,
        providerReference,
        previousStatus,
        newStatus: nextStatus,
        validationResult: 'FAILED',
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }
}

export const paymentAttemptService = new PaymentAttemptService();
