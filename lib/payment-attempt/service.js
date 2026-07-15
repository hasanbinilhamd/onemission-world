import crypto from 'node:crypto';
import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { checkoutService } from '@/lib/checkout';
import { domainEventPublisher } from '@/lib/domain-events/publisher';
import { notificationService, NOTIFICATION_EVENT_TYPE } from '@/lib/notifications';
import { paymentAttemptConfig } from './config';
import { PaymentAttemptError } from './errors';
import { MidtransProvider } from './providers/midtrans-provider';

const ACTIVE_PAYMENT_ATTEMPT_STATUSES = ['CREATED', 'PENDING'];
const SNAP_GENERATABLE_STATUSES = ['CREATED'];
const PAYMENT_ATTEMPT_STATUS_TRANSITIONS = {
  CREATED: ['CREATED', 'PENDING', 'PAID', 'EXPIRED', 'FAILED', 'CANCELLED'],
  PENDING: ['PENDING', 'PAID', 'EXPIRED', 'FAILED', 'CANCELLED'],
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

function logWebhookPhase({
  phase = '',
  attemptId = '',
  attemptNumber = '',
  checkoutSessionId = '',
  checkoutNumber = '',
  orderId = '',
  orderNumber = '',
  providerReference = '',
  inventoryReservationResult = '',
  transactionDurationMs = 0,
  durationMs = 0,
  reason = '',
  validationResult = 'PASSED',
}) {
  const payload = {
    phase,
    attemptId,
    attemptNumber,
    checkoutSessionId,
    checkoutNumber,
    orderId,
    orderNumber,
    providerReference,
    inventoryReservationResult,
    transactionDurationMs,
    durationMs,
    reason,
    validationResult,
  };

  if (validationResult === 'FAILED') {
    console.warn('[PaymentAttemptService]', payload);
    return;
  }

  console.log('[PaymentAttemptService]', payload);
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
    resolveOrderForCheckout = async () => null,
  } = {}) {
    this.prisma = prismaClient;
    this.checkoutService = checkout;
    this.paymentProvider = paymentProvider;
    this.eventPublisher = eventPublisher;
    this.idGenerator = idGenerator;
    this.nowFactory = nowFactory;
    this.providerReferenceGenerator = providerReferenceGenerator;
    this.resolveOrderForCheckout = resolveOrderForCheckout;
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

  async syncExpiredAttempt(attempt) {
    if (!attempt) {
      return attempt;
    }

    const expiresAt = new Date(attempt.expiresAt);
    const isExpired = !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= this.nowFactory().getTime();
    const isExpirable = ACTIVE_PAYMENT_ATTEMPT_STATUSES.includes(attempt.status);

    if (!isExpired || !isExpirable) {
      return attempt;
    }

    const updatedAttempt = await this.prisma.$transaction(async (tx) => {
      const nextAttempt = await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'EXPIRED' },
      });

      if (typeof tx.checkoutSession.updateMany === 'function') {
        await tx.checkoutSession.updateMany({
          where: {
            id: attempt.checkoutSessionId,
            status: { in: CHECKOUT_PENDING_STATUSES },
          },
          data: { status: 'EXPIRED' },
        });
      } else {
        await tx.checkoutSession.update({
          where: { id: attempt.checkoutSessionId },
          data: { status: 'EXPIRED' },
        });
      }

      return nextAttempt;
    });

    return updatedAttempt;
  }

  async getPaymentAttemptStateById(paymentAttemptId) {
    const attempt = await this.getPaymentAttemptById(paymentAttemptId);
    return this.syncExpiredAttempt(attempt);
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

    const order = await this.prisma.order.findFirst({
      where: { paymentAttemptId },
      select: {
        id: true,
        orderNumber: true,
      },
    });

    if (order) {
      return order;
    }

    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { id: paymentAttemptId },
      select: {
        orderId: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
          },
        },
      },
    });

    return attempt?.order || null;
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
      paymentMethod: attempt.paymentType || attempt.provider,
      issuer: attempt.issuer,
      acquirer: attempt.acquirer,
      fraudStatus: attempt.fraudStatus,
      transactionTime: attempt.transactionTime,
      settlementTime: attempt.settlementTime,
      providerPayload: attempt.providerPayload,
      expiresAt: attempt.expiresAt,
      orderId: attempt.orderId || '',
      createdAt: attempt.createdAt,
      updatedAt: attempt.updatedAt,
    };
  }

  async cancelPaymentAttempt({ paymentAttemptId }) {
    const startedAt = Date.now();
    const attempt = await this.getPaymentAttemptStateById(paymentAttemptId);

    if (attempt.status === 'CANCELLED') {
      logPaymentAttempt({
        attemptNumber: attempt.attemptNumber,
        providerReference: attempt.providerReference,
        previousStatus: attempt.status,
        newStatus: attempt.status,
        validationResult: 'REUSED',
        durationMs: Date.now() - startedAt,
      });
      return this.buildPaymentAttemptResponse(attempt);
    }

    if (!ACTIVE_PAYMENT_ATTEMPT_STATUSES.includes(attempt.status)) {
      throw new PaymentAttemptError({
        message: 'Only pending payment attempts can be cancelled.',
        statusCode: 409,
        code: 'PAYMENT_ATTEMPT_CANCELLATION_NOT_ALLOWED',
      });
    }

    const updatedAttempt = await this.prisma.$transaction(async (tx) => {
      const nextAttempt = await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'CANCELLED' },
      });

      if (typeof tx.checkoutSession.updateMany === 'function') {
        await tx.checkoutSession.updateMany({
          where: {
            id: attempt.checkoutSessionId,
            status: { in: CHECKOUT_PENDING_STATUSES },
          },
          data: { status: 'CANCELLED' },
        });
      } else {
        await tx.checkoutSession.update({
          where: { id: attempt.checkoutSessionId },
          data: { status: 'CANCELLED' },
        });
      }

      return nextAttempt;
    });

    logPaymentAttempt({
      attemptNumber: updatedAttempt.attemptNumber,
      providerReference: updatedAttempt.providerReference,
      previousStatus: attempt.status,
      newStatus: updatedAttempt.status,
      validationResult: 'CANCELLED',
      durationMs: Date.now() - startedAt,
    });

    return this.buildPaymentAttemptResponse(updatedAttempt);
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

      const order = await this.resolveOrderForCheckout({
        checkoutSessionId,
        checkoutSession,
      });

      const existingAttempt = await this.findActiveAttempt(checkoutSessionId);
      if (existingAttempt) {
        if (order?.id) {
          if (existingAttempt.orderId !== order.id) {
            await this.prisma.paymentAttempt.update({
              where: { id: existingAttempt.id },
              data: { orderId: order.id },
            });
          }
          if (order.paymentAttemptId !== existingAttempt.id) {
            await this.prisma.order.update({
              where: { id: order.id },
              data: { paymentAttemptId: existingAttempt.id },
            });
          }
        }
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
          orderId: order?.id || null,
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

      if (order?.id) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: { paymentAttemptId: attempt.id },
        });
      }

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
      const attempt = await this.getPaymentAttemptStateById(paymentAttemptId);
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
    let currentPhase = 'WEBHOOK_RECEIVED';
    let attemptId = '';
    let attemptNumber = '';
    let checkoutSessionId = '';
    let checkoutNumber = '';
    let orderId = '';
    let orderNumber = '';
    let providerReference = '';
    let previousStatus = '';
    let nextStatus = '';

    try {
      logWebhookPhase({
        phase: currentPhase,
        durationMs: 0,
        validationResult: 'RECEIVED',
      });

      await this.paymentProvider.verifyNotificationSignature(payload);
      currentPhase = 'SIGNATURE_VERIFIED';
      logWebhookPhase({
        phase: currentPhase,
        durationMs: Date.now() - startedAt,
      });

      const normalizedNotification = await this.paymentProvider.normalizeNotification(payload);
      providerReference = normalizedNotification.providerReference;
      nextStatus = normalizedNotification.internalStatus;

      const attempt = await this.getPaymentAttemptByProviderReference(providerReference);
      attemptId = attempt.id;
      attemptNumber = attempt.attemptNumber;
      previousStatus = attempt.status;
      checkoutSessionId = attempt.checkoutSessionId;

      const checkoutSession = await this.getCheckoutSessionSnapshot(checkoutSessionId);
      checkoutNumber = checkoutSession.checkoutNumber || '';

      let workingAttempt = attempt;
      currentPhase = 'PAYMENT_UPDATED';

      if (previousStatus === nextStatus) {
        workingAttempt = await this.persistAuditFields(
          attempt,
          normalizedNotification,
          previousStatus,
        );
        logWebhookPhase({
          phase: currentPhase,
          attemptId,
          attemptNumber,
          checkoutSessionId,
          checkoutNumber,
          providerReference,
          durationMs: Date.now() - startedAt,
          validationResult: 'REUSED',
        });
      } else {
        if (!isTransitionAllowed(previousStatus, nextStatus)) {
          throw new PaymentAttemptError({
            message: 'Payment attempt cannot transition to the requested status.',
            statusCode: 409,
            code: 'PAYMENT_ATTEMPT_INVALID_TRANSITION',
          });
        }

        workingAttempt = await this.persistAuditFields(
          attempt,
          normalizedNotification,
          nextStatus,
        );
        logWebhookPhase({
          phase: currentPhase,
          attemptId,
          attemptNumber,
          checkoutSessionId,
          checkoutNumber,
          providerReference,
          durationMs: Date.now() - startedAt,
          validationResult: 'UPDATED',
        });
      }

      if (nextStatus === 'REFUNDED' || nextStatus === 'CANCELLED') {
        const relatedOrder = await this.prisma.order.findFirst({
          where: { paymentAttemptId: attempt.id },
          select: {
            orderNumber: true,
            publicOrderNumber: true,
          },
        });

        if (relatedOrder) {
          await notificationService.dispatch({
            type: nextStatus === 'REFUNDED' ? NOTIFICATION_EVENT_TYPE.ORDER_REFUNDED : NOTIFICATION_EVENT_TYPE.ORDER_CANCELLED,
            payload: {
              orderNumber: relatedOrder.orderNumber,
              publicOrderNumber: relatedOrder.publicOrderNumber,
            },
            prismaClient: this.prisma,
          });
        }
      }

      if (['EXPIRED', 'CANCELLED'].includes(nextStatus)) {
        currentPhase = 'CHECKOUT_UPDATED';
        const targetCheckoutStatus = nextStatus;
        if (checkoutSession.status !== targetCheckoutStatus) {
          if (typeof this.prisma.checkoutSession.updateMany === 'function') {
            await this.prisma.checkoutSession.updateMany({
              where: {
                id: checkoutSession.id,
                status: { in: CHECKOUT_PENDING_STATUSES },
              },
              data: { status: targetCheckoutStatus },
            });
          } else {
            await this.prisma.checkoutSession.update({
              where: { id: checkoutSession.id },
              data: { status: targetCheckoutStatus },
            });
          }
          logWebhookPhase({
            phase: currentPhase,
            attemptId,
            attemptNumber,
            checkoutSessionId,
            checkoutNumber,
            providerReference,
            durationMs: Date.now() - startedAt,
            validationResult: 'UPDATED',
          });
        } else {
          logWebhookPhase({
            phase: currentPhase,
            attemptId,
            attemptNumber,
            checkoutSessionId,
            checkoutNumber,
            providerReference,
            durationMs: Date.now() - startedAt,
            validationResult: 'REUSED',
          });
        }
      }

      if (SUCCESSFUL_PAYMENT_STATUSES.includes(nextStatus)) {
        currentPhase = 'CHECKOUT_UPDATED';
        if (checkoutSession.status !== 'PAID') {
          await this.prisma.checkoutSession.update({
            where: { id: checkoutSession.id },
            data: { status: 'PAID' },
          });
          logWebhookPhase({
            phase: currentPhase,
            attemptId,
            attemptNumber,
            checkoutSessionId,
            checkoutNumber,
            providerReference,
            durationMs: Date.now() - startedAt,
            validationResult: 'UPDATED',
          });
        } else {
          logWebhookPhase({
            phase: currentPhase,
            attemptId,
            attemptNumber,
            checkoutSessionId,
            checkoutNumber,
            providerReference,
            durationMs: Date.now() - startedAt,
            validationResult: 'REUSED',
          });
        }

        currentPhase = 'ORDER_FOUND';
        const existingOrder = await this.getOrderByPaymentAttemptId(workingAttempt.id);

        if (existingOrder) {
          orderId = existingOrder.id || '';
          orderNumber = existingOrder.orderNumber || '';
          logWebhookPhase({
            phase: currentPhase,
            attemptId,
            attemptNumber,
            checkoutSessionId,
            checkoutNumber,
            orderId,
            orderNumber,
            providerReference,
            durationMs: Date.now() - startedAt,
            validationResult: 'REUSED',
          });
        } else {
          currentPhase = 'ORDER_CREATED';
          const order = await this.onPaymentConfirmed(workingAttempt);
          orderId = order?.id || '';
          orderNumber = order?.orderNumber || '';
          const orderAction = order?.__meta?.action || (orderNumber ? 'CREATED' : 'UNKNOWN');
          const inventoryReservationResult = order?.__meta?.inventoryReservationResult
            || (order?.__meta?.inventoryCommitted ? 'COMMITTED' : 'SKIPPED');
          const phase = orderAction === 'FOUND' ? 'ORDER_FOUND' : 'ORDER_CREATED';

          logWebhookPhase({
            phase,
            attemptId,
            attemptNumber,
            checkoutSessionId,
            checkoutNumber,
            orderId,
            orderNumber,
            providerReference,
            inventoryReservationResult,
            durationMs: Date.now() - startedAt,
            validationResult: orderAction === 'FOUND' ? 'REUSED' : 'CREATED',
          });

          if (order?.__meta?.inventoryCommitted) {
            currentPhase = 'INVENTORY_COMMITTED';
            logWebhookPhase({
              phase: currentPhase,
              attemptId,
              attemptNumber,
              checkoutSessionId,
              checkoutNumber,
              orderId,
              orderNumber,
              providerReference,
              inventoryReservationResult,
              durationMs: Date.now() - startedAt,
              validationResult: 'COMMITTED',
            });
          }

          if (previousStatus !== nextStatus && orderAction !== 'FOUND') {
            await this.eventPublisher.publish('PaymentSettled', {
              paymentAttemptId: workingAttempt.id,
              paymentAttemptNumber: workingAttempt.attemptNumber,
              checkoutSessionId: workingAttempt.checkoutSessionId,
              providerReference,
            });
          }
        }
      }

      logPaymentAttempt({
        attemptNumber: workingAttempt.attemptNumber,
        checkoutNumber,
        providerReference,
        previousStatus,
        newStatus: workingAttempt.status,
        validationResult: 'CONFIRMED',
        durationMs: Date.now() - startedAt,
      });

      logWebhookAudit({
        attemptNumber: workingAttempt.attemptNumber,
        checkoutNumber,
        orderNumber,
        paymentType: workingAttempt.paymentType,
        issuer: workingAttempt.issuer,
        acquirer: workingAttempt.acquirer,
        fraudStatus: workingAttempt.fraudStatus,
        settlementTime: workingAttempt.settlementTime,
        providerTransactionId: workingAttempt.providerTransactionId,
        grossAmount: workingAttempt.grossAmount,
        validationResult: previousStatus === nextStatus ? 'DUPLICATE_WEBHOOK_IGNORED' : 'AUDIT_PERSISTED',
        durationMs: Date.now() - startedAt,
      });

      currentPhase = 'WEBHOOK_COMPLETED';
      logWebhookPhase({
        phase: currentPhase,
        attemptId,
        attemptNumber: workingAttempt.attemptNumber,
        checkoutSessionId,
        checkoutNumber,
        orderId,
        orderNumber,
        providerReference,
        durationMs: Date.now() - startedAt,
        validationResult: 'COMPLETED',
      });

      return this.buildPaymentAttemptResponse(workingAttempt);
    } catch (error) {
      orderId = orderId || error?.orderId || '';
      orderNumber = orderNumber || error?.orderNumber || '';
      checkoutSessionId = checkoutSessionId || error?.checkoutSessionId || '';
      attemptId = attemptId || error?.paymentAttemptId || '';

      logWebhookPhase({
        phase: currentPhase,
        attemptId,
        attemptNumber,
        checkoutSessionId,
        checkoutNumber,
        orderId,
        orderNumber,
        providerReference,
        inventoryReservationResult: error?.inventoryReservationResult || '',
        durationMs: Date.now() - startedAt,
        reason: error?.message || 'Unknown webhook processing error.',
        validationResult: 'FAILED',
      });

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
