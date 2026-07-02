import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { checkoutService } from '@/lib/checkout';
import { domainEventPublisher } from '@/lib/domain-events/publisher';
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

const SUCCESSFUL_PAYMENT_STATUSES = ['PAID'];
const CHECKOUT_PENDING_STATUSES = ['DRAFT', 'PENDING'];

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

function splitCustomerName(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return { firstName: '', lastName: '' };
  }

  const [firstName, ...rest] = normalized.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(' '),
  };
}

export class PaymentAttemptService {
  constructor({
    prismaClient = prisma,
    checkout = checkoutService,
    paymentProvider = new MidtransProvider(),
    eventPublisher = domainEventPublisher,
    idGenerator = uuid,
    nowFactory = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.checkoutService = checkout;
    this.paymentProvider = paymentProvider;
    this.eventPublisher = eventPublisher;
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

  async getCheckoutSessionSnapshot(checkoutSessionId) {
    const checkoutSession = await this.prisma.checkoutSession.findUnique({
      where: { id: checkoutSessionId },
      include: { items: true },
    });

    if (!checkoutSession) {
      throw new PaymentAttemptError({
        message: 'Checkout session was not found.',
        statusCode: 404,
        code: 'CHECKOUT_SESSION_NOT_FOUND',
      });
    }

    return checkoutSession;
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
      fraudStatus: attempt.fraudStatus,
      paymentType: attempt.paymentType,
      transactionTime: attempt.transactionTime,
      settlementTime: attempt.settlementTime,
      providerPayload: attempt.providerPayload,
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

      const customerName = checkoutSession.customer?.customerName || checkoutSession.shipping?.recipientName || '';
      const { firstName, lastName } = splitCustomerName(customerName);
      const providerReference = attempt.providerReference || attempt.attemptNumber;
      const providerResult = await this.paymentProvider.createPaymentSession({
        order_number: providerReference,
        gross_amount: checkoutSession.totals?.grandTotal ?? checkoutSession.grandTotal,
        first_name: firstName,
        last_name: lastName,
        email: checkoutSession.customer?.email || '',
        phone: checkoutSession.shipping?.phone || checkoutSession.customer?.phone || '',
        created_at: attempt.createdAt,
        customer_name: customerName,
      });

      const updatedAttempt = await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          providerReference: providerResult.providerReference || providerReference,
          providerTransactionId: providerResult.providerTransactionId || '',
          snapToken: providerResult.snapToken || '',
          snapRedirectUrl: providerResult.redirectUrl || providerResult.snapRedirectUrl || '',
          status: 'PENDING',
        },
      });

      if (checkoutSession.status === 'DRAFT') {
        await this.prisma.checkoutSession.update({
          where: { id: checkoutSession.id },
          data: { status: 'PENDING' },
        });
      }

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
      console.log('[PaymentAttemptService]', { validationResult: 'WEBHOOK_RECEIVED', durationMs: 0 });

      await this.paymentProvider.verifyNotificationSignature(payload);
      console.log('[PaymentAttemptService]', { validationResult: 'SIGNATURE_VERIFIED', durationMs: 0 });

      const normalizedNotification = await this.paymentProvider.normalizeNotification(payload);
      providerReference = normalizedNotification.providerReference;
      nextStatus = normalizedNotification.internalStatus;

      const attempt = await this.getPaymentAttemptByProviderReference(providerReference);
      attemptNumber = attempt.attemptNumber;
      previousStatus = attempt.status;

      const checkoutSession = await this.getCheckoutSessionSnapshot(attempt.checkoutSessionId);
      checkoutNumber = checkoutSession.checkoutNumber || '';

      if (previousStatus === nextStatus) {
        if (SUCCESSFUL_PAYMENT_STATUSES.includes(nextStatus)) {
          if (checkoutSession.status !== 'PAID') {
            await this.prisma.checkoutSession.update({
              where: { id: checkoutSession.id },
              data: { status: 'PAID' },
            });
            console.log('[PaymentAttemptService]', {
              validationResult: 'CHECKOUT_UPDATED',
              checkoutNumber,
              previousStatus: checkoutSession.status,
              newStatus: 'PAID',
              durationMs: Date.now() - startedAt,
            });
          }

          await this.eventPublisher.publish('PaymentSettled', {
            paymentAttemptId: attempt.id,
            paymentAttemptNumber: attempt.attemptNumber,
            checkoutSessionId: attempt.checkoutSessionId,
            providerReference,
          });

          await this.onPaymentConfirmed(attempt);
        }

        console.log('[PaymentAttemptService]', {
          validationResult: 'DUPLICATE_WEBHOOK_IGNORED',
          attemptNumber,
          checkoutNumber,
          providerReference,
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

      const updatedAttempt = await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          providerReference: normalizedNotification.providerReference || attempt.providerReference,
          providerTransactionId: normalizedNotification.providerTransactionId || attempt.providerTransactionId,
          fraudStatus: normalizedNotification.fraudStatus || attempt.fraudStatus || '',
          paymentType: normalizedNotification.paymentType || attempt.paymentType || '',
          transactionTime: normalizedNotification.transactionTime || attempt.transactionTime || null,
          settlementTime: normalizedNotification.settlementTime || attempt.settlementTime || null,
          providerPayload: normalizedNotification.providerPayload || attempt.providerPayload || null,
          status: nextStatus,
        },
      });

      console.log('[PaymentAttemptService]', {
        validationResult: 'PAYMENT_UPDATED',
        attemptNumber: updatedAttempt.attemptNumber,
        providerReference,
        previousStatus,
        newStatus: updatedAttempt.status,
        durationMs: Date.now() - startedAt,
      });

      if (SUCCESSFUL_PAYMENT_STATUSES.includes(nextStatus)) {
        if (CHECKOUT_PENDING_STATUSES.includes(checkoutSession.status)) {
          await this.prisma.checkoutSession.update({
            where: { id: checkoutSession.id },
            data: { status: 'PAID' },
          });
          console.log('[PaymentAttemptService]', {
            validationResult: 'CHECKOUT_UPDATED',
            checkoutNumber,
            previousStatus: checkoutSession.status,
            newStatus: 'PAID',
            durationMs: Date.now() - startedAt,
          });
        }

        await this.eventPublisher.publish('PaymentSettled', {
          paymentAttemptId: updatedAttempt.id,
          paymentAttemptNumber: updatedAttempt.attemptNumber,
          checkoutSessionId: updatedAttempt.checkoutSessionId,
          providerReference,
        });

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
