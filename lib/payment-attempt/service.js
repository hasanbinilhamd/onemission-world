import crypto from 'node:crypto';
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
const PROVIDER_REFERENCE_SUFFIX_LENGTH = 6;
const PROVIDER_REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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

function logWebhookAudit({
  attemptNumber = '',
  checkoutNumber = '',
  orderNumber = '',
  paymentType = '',
  issuer = '',
  acquirer = '',
  fraudStatus = '',
  settlementTime = null,
  providerTransactionId = '',
  grossAmount = 0,
  validationResult,
  durationMs,
}) {
  console.log('[PaymentAttemptService]', {
    attemptNumber,
    checkoutNumber,
    orderNumber,
    paymentType,
    issuer,
    acquirer,
    fraudStatus,
    settlementTime,
    providerTransactionId,
    grossAmount,
    validationResult,
    durationMs,
  });
}

function isUniqueConstraintError(error) {
  return (
    error?.code === 'P2002'
    || String(error?.message || '').includes('PaymentAttempt_active_checkout_idx')
  );
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

function buildAuditUpdateData({ attempt, notification }) {
  const nextGrossAmount = Number.isFinite(notification.grossAmount)
    ? notification.grossAmount
    : attempt.grossAmount;

  return {
    providerReference: notification.providerReference || attempt.providerReference,
    providerTransactionId: notification.providerTransactionId || attempt.providerTransactionId,
    grossAmount: nextGrossAmount,
    currency: notification.currency || attempt.currency || 'IDR',
    paymentType: notification.paymentType || attempt.paymentType || '',
    issuer: notification.issuer || attempt.issuer || '',
    acquirer: notification.acquirer || attempt.acquirer || '',
    fraudStatus: notification.fraudStatus || attempt.fraudStatus || '',
    transactionTime: notification.transactionTime || attempt.transactionTime || null,
    settlementTime: notification.settlementTime || attempt.settlementTime || null,
    providerPayload: notification.providerPayload ?? attempt.providerPayload ?? null,
  };
}

function generateProviderReferenceSuffix(length = PROVIDER_REFERENCE_SUFFIX_LENGTH) {
  const bytes = crypto.randomBytes(length);
  let suffix = '';

  for (let index = 0; index < length; index += 1) {
    const alphabetIndex = bytes[index] % PROVIDER_REFERENCE_ALPHABET.length;
    suffix += PROVIDER_REFERENCE_ALPHABET[alphabetIndex];
  }

  return suffix;
}

function buildProviderReference(attemptNumber, suffix) {
  return `${attemptNumber}-${suffix}`;
}

function maskSnapToken(value) {
  const token = String(value || '').trim();
  if (!token) {
    return '';
  }

  if (token.length <= 10) {
    return `${token.slice(0, 2)}***${token.slice(-2)}`;
  }

  return `${token.slice(0, 6)}***${token.slice(-4)}`;
}

function classifySnapError(error) {
  if (!(error instanceof PaymentAttemptError)) {
    return 'UNEXPECTED_INTERNAL_ERROR';
  }

  if ([
    'PAYMENT_ATTEMPT_ID_REQUIRED',
    'PAYMENT_ATTEMPT_NOT_FOUND',
    'PAYMENT_ATTEMPT_INVALID_STATUS',
    'CHECKOUT_SESSION_NOT_FOUND',
    'CHECKOUT_SESSION_EXPIRED',
    'CHECKOUT_INVALID_STATUS',
    'PAYMENT_ATTEMPT_PROVIDER_REFERENCE_GENERATION_FAILED',
  ].includes(error.code)) {
    return 'VALIDATION_ERROR';
  }

  if (error.code === 'PAYMENT_ATTEMPT_PROVIDER_REFERENCE_CONFLICT') {
    return 'DUPLICATE_ORDER_ID';
  }

  if (error.code === 'PAYMENT_ATTEMPT_PROVIDER_TIMEOUT') {
    return 'NETWORK_TIMEOUT';
  }

  if ([
    'PAYMENT_ATTEMPT_PROVIDER_UNAVAILABLE',
    'PAYMENT_ATTEMPT_PROVIDER_UNAUTHORIZED',
    'PAYMENT_ATTEMPT_PROVIDER_BAD_REQUEST',
    'PAYMENT_ATTEMPT_PROVIDER_ERROR',
  ].includes(error.code)) {
    return 'PROVIDER_UNAVAILABLE';
  }

  return 'UNEXPECTED_INTERNAL_ERROR';
}

function logSnapRequest({
  checkoutNumber = '',
  paymentAttemptNumber = '',
  providerReference = '',
  grossAmount = 0,
  currency = '',
  customerId = '',
  timestamp = '',
}) {
  console.log('[PaymentAttemptService]', {
    checkoutNumber,
    paymentAttemptNumber,
    providerReference,
    grossAmount,
    currency,
    customerId,
    timestamp,
    validationResult: 'SNAP_REQUEST_STARTED',
  });
}

function logSnapResponse({
  checkoutNumber = '',
  paymentAttemptNumber = '',
  providerReference = '',
  snapToken = '',
  redirectUrl = '',
  providerTransactionId = '',
  durationMs = 0,
  status = '',
  httpStatus = null,
}) {
  console.log('[PaymentAttemptService]', {
    checkoutNumber,
    paymentAttemptNumber,
    providerReference,
    snapToken: maskSnapToken(snapToken),
    redirectUrl,
    providerTransactionId,
    durationMs,
    status,
    httpStatus,
    validationResult: 'SNAP_REQUEST_SUCCEEDED',
  });
}

function logSnapFailure({
  checkoutNumber = '',
  paymentAttemptNumber = '',
  providerReference = '',
  durationMs = 0,
  httpStatus = null,
  errorMessage = '',
  errorCode = '',
  errorCategory = '',
  stack = '',
}) {
  const payload = {
    checkoutNumber,
    paymentAttemptNumber,
    providerReference,
    durationMs,
    httpStatus,
    errorMessage,
    errorCode,
    errorCategory,
    validationResult: 'SNAP_REQUEST_FAILED',
  };

  if (stack) {
    payload.stack = stack;
  }

  console.warn('[PaymentAttemptService]', payload);
}

export class PaymentAttemptService {
  constructor({
    prismaClient = prisma,
    checkout = checkoutService,
    paymentProvider = new MidtransProvider(),
    eventPublisher = domainEventPublisher,
    idGenerator = uuid,
    nowFactory = () => new Date(),
    providerReferenceGenerator = () => generateProviderReferenceSuffix(),
  } = {}) {
    this.prisma = prismaClient;
    this.checkoutService = checkout;
    this.paymentProvider = paymentProvider;
    this.eventPublisher = eventPublisher;
    this.idGenerator = idGenerator;
    this.nowFactory = nowFactory;
    this.providerReferenceGenerator = providerReferenceGenerator;
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
        OR: [{ providerReference }, { attemptNumber: providerReference }],
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

  async getOrderByPaymentAttemptId(paymentAttemptId) {
    if (!this.prisma.order?.findFirst) {
      return null;
    }

    return this.prisma.order.findFirst({
      where: { paymentAttemptId },
      select: {
        id: true,
        orderNumber: true,
      },
    });
  }

  async persistAuditFields(attempt, notification, nextStatus = attempt.status) {
    return this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        ...buildAuditUpdateData({ attempt, notification }),
        status: nextStatus,
      },
    });
  }

  async isProviderReferenceTaken(providerReference, paymentAttemptId) {
    const existingAttempt = await this.prisma.paymentAttempt.findFirst({
      where: { providerReference },
      select: { id: true },
    });

    return Boolean(existingAttempt && existingAttempt.id !== paymentAttemptId);
  }

  async ensureProviderReference(attempt) {
    if (attempt.providerReference) {
      return attempt;
    }

    for (let iteration = 0; iteration < 10; iteration += 1) {
      const candidate = buildProviderReference(
        attempt.attemptNumber,
        this.providerReferenceGenerator(),
      );
      const isTaken = await this.isProviderReferenceTaken(candidate, attempt.id);

      if (isTaken) {
        continue;
      }

      return this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { providerReference: candidate },
      });
    }

    throw new PaymentAttemptError({
      message: 'Payment attempt provider reference could not be generated.',
      statusCode: 500,
      code: 'PAYMENT_ATTEMPT_PROVIDER_REFERENCE_GENERATION_FAILED',
    });
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
      paymentType: attempt.paymentType,
      issuer: attempt.issuer,
      acquirer: attempt.acquirer,
      fraudStatus: attempt.fraudStatus,
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

      const checkoutSession = await this.checkoutService.getCheckoutSessionForPayment(
        checkoutSessionId,
      );
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
          grossAmount:
            checkoutSession.totals?.grandTotal ?? checkoutSession.grandTotal,
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
    let providerReference = '';

    try {
      const attempt = await this.getPaymentAttemptById(paymentAttemptId);
      attemptNumber = attempt.attemptNumber;
      this.validatePaymentAttemptForSnap(attempt);

      const checkoutSession = await this.checkoutService.getCheckoutSessionForPayment(
        attempt.checkoutSessionId,
      );
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

      const attemptWithProviderReference = await this.ensureProviderReference(attempt);
      providerReference = attemptWithProviderReference.providerReference;

      const customerName =
        checkoutSession.customer?.customerName
        || checkoutSession.shipping?.recipientName
        || '';
      const { firstName, lastName } = splitCustomerName(customerName);
      const grossAmount =
        checkoutSession.totals?.grandTotal ?? checkoutSession.grandTotal;
      const currency = checkoutSession.currency || attemptWithProviderReference.currency || 'IDR';
      const customerId = checkoutSession.customer?.id || '';

      logSnapRequest({
        checkoutNumber,
        paymentAttemptNumber: attemptNumber,
        providerReference,
        grossAmount,
        currency,
        customerId,
        timestamp: this.nowFactory().toISOString(),
      });

      const providerResult = await this.paymentProvider.createPaymentSession({
        order_number: providerReference,
        gross_amount: grossAmount,
        currency,
        first_name: firstName,
        last_name: lastName,
        email: checkoutSession.customer?.email || '',
        phone:
          checkoutSession.shipping?.phone
          || checkoutSession.customer?.phone
          || '',
        created_at: attemptWithProviderReference.createdAt,
        customer_name: customerName,
      });

      const updatedAttempt = await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          providerReference: providerResult.providerReference || providerReference,
          providerTransactionId: providerResult.providerTransactionId || '',
          snapToken: providerResult.snapToken || '',
          snapRedirectUrl:
            providerResult.redirectUrl || providerResult.snapRedirectUrl || '',
          status: 'PENDING',
        },
      });

      if (checkoutSession.status === 'DRAFT') {
        await this.prisma.checkoutSession.update({
          where: { id: checkoutSession.id },
          data: { status: 'PENDING' },
        });
      }

      logSnapResponse({
        checkoutNumber,
        paymentAttemptNumber: updatedAttempt.attemptNumber,
        providerReference: updatedAttempt.providerReference,
        snapToken: updatedAttempt.snapToken,
        redirectUrl: updatedAttempt.snapRedirectUrl,
        providerTransactionId: updatedAttempt.providerTransactionId,
        durationMs: Date.now() - startedAt,
        status: updatedAttempt.status,
        httpStatus: providerResult.httpStatus || null,
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
      logSnapFailure({
        checkoutNumber,
        paymentAttemptNumber: attemptNumber,
        providerReference,
        durationMs: Date.now() - startedAt,
        httpStatus: error?.httpStatus || null,
        errorMessage: error?.providerMessage || error?.message || 'Unknown Midtrans Snap error.',
        errorCode: error?.code || 'PAYMENT_ATTEMPT_INTERNAL_ERROR',
        errorCategory: classifySnapError(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack || '' : '',
      });

      logPaymentAttempt({
        attemptNumber,
        checkoutNumber,
        providerReference,
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
      console.log('[PaymentAttemptService]', {
        validationResult: 'WEBHOOK_RECEIVED',
        durationMs: 0,
      });

      await this.paymentProvider.verifyNotificationSignature(payload);
      console.log('[PaymentAttemptService]', {
        validationResult: 'SIGNATURE_VERIFIED',
        durationMs: 0,
      });

      const normalizedNotification = await this.paymentProvider.normalizeNotification(payload);
      providerReference = normalizedNotification.providerReference;
      nextStatus = normalizedNotification.internalStatus;

      const attempt = await this.getPaymentAttemptByProviderReference(providerReference);
      attemptNumber = attempt.attemptNumber;
      previousStatus = attempt.status;

      const checkoutSession = await this.getCheckoutSessionSnapshot(
        attempt.checkoutSessionId,
      );
      checkoutNumber = checkoutSession.checkoutNumber || '';

      if (previousStatus === nextStatus) {
        const auditedAttempt = await this.persistAuditFields(
          attempt,
          normalizedNotification,
          previousStatus,
        );

        let orderNumber = '';

        if (SUCCESSFUL_PAYMENT_STATUSES.includes(nextStatus) && checkoutSession.status !== 'PAID') {
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

        if (SUCCESSFUL_PAYMENT_STATUSES.includes(nextStatus)) {
          const existingOrder = await this.getOrderByPaymentAttemptId(auditedAttempt.id);
          orderNumber = existingOrder?.orderNumber || '';
        }

        logWebhookAudit({
          attemptNumber: auditedAttempt.attemptNumber,
          checkoutNumber,
          orderNumber,
          paymentType: auditedAttempt.paymentType,
          issuer: auditedAttempt.issuer,
          acquirer: auditedAttempt.acquirer,
          fraudStatus: auditedAttempt.fraudStatus,
          settlementTime: auditedAttempt.settlementTime,
          providerTransactionId: auditedAttempt.providerTransactionId,
          grossAmount: auditedAttempt.grossAmount,
          validationResult: 'DUPLICATE_WEBHOOK_IGNORED',
          durationMs: Date.now() - startedAt,
        });

        return this.buildPaymentAttemptResponse(auditedAttempt);
      }

      if (!isTransitionAllowed(previousStatus, nextStatus)) {
        throw new PaymentAttemptError({
          message: 'Payment attempt cannot transition to the requested status.',
          statusCode: 409,
          code: 'PAYMENT_ATTEMPT_INVALID_TRANSITION',
        });
      }

      const updatedAttempt = await this.persistAuditFields(
        attempt,
        normalizedNotification,
        nextStatus,
      );

      if (SUCCESSFUL_PAYMENT_STATUSES.includes(nextStatus)
        && CHECKOUT_PENDING_STATUSES.includes(checkoutSession.status)) {
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

      let orderNumber = '';

      if (SUCCESSFUL_PAYMENT_STATUSES.includes(nextStatus)) {
        await this.eventPublisher.publish('PaymentSettled', {
          paymentAttemptId: updatedAttempt.id,
          paymentAttemptNumber: updatedAttempt.attemptNumber,
          checkoutSessionId: updatedAttempt.checkoutSessionId,
          providerReference,
        });

        const order = await this.onPaymentConfirmed(updatedAttempt);
        orderNumber = order?.orderNumber || '';
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

      logWebhookAudit({
        attemptNumber: updatedAttempt.attemptNumber,
        checkoutNumber,
        orderNumber,
        paymentType: updatedAttempt.paymentType,
        issuer: updatedAttempt.issuer,
        acquirer: updatedAttempt.acquirer,
        fraudStatus: updatedAttempt.fraudStatus,
        settlementTime: updatedAttempt.settlementTime,
        providerTransactionId: updatedAttempt.providerTransactionId,
        grossAmount: updatedAttempt.grossAmount,
        validationResult: 'AUDIT_PERSISTED',
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
