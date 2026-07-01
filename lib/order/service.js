import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { checkoutService } from '@/lib/checkout';
import { paymentAttemptService } from '@/lib/payment-attempt';
import { OrderError } from './errors';

const ORDER_STATUS = 'READY_FOR_FULFILLMENT';

function logOrderCreation({ orderNumber = '', checkoutNumber = '', paymentAttemptNumber = '', durationMs, validationResult }) {
  const payload = {
    orderNumber,
    checkoutNumber,
    paymentAttemptNumber,
    durationMs,
    validationResult,
  };

  if (validationResult === 'FAILED') {
    console.warn('[OrderService]', payload);
    return;
  }

  console.log('[OrderService]', payload);
}

export class OrderService {
  constructor({
    prismaClient = prisma,
    checkout = checkoutService,
    paymentAttempt = paymentAttemptService,
    idGenerator = uuid,
    nowFactory = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.checkoutService = checkout;
    this.paymentAttemptService = paymentAttempt;
    this.idGenerator = idGenerator;
    this.nowFactory = nowFactory;
  }

  async generateOrderNumber() {
    const now = this.nowFactory();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `ORD-${year}${month}-`;

    const existing = await this.prisma.order.findMany({
      where: { orderNumber: { startsWith: prefix } },
      select: { orderNumber: true },
      orderBy: { orderNumber: 'desc' },
    });

    let maxSeq = 0;
    for (const entry of existing) {
      const parts = entry.orderNumber.split('-');
      const seq = parseInt(parts[parts.length - 1] || '0', 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }

    return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
  }

  buildOrderResponse(order) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      checkoutSessionId: order.checkoutSessionId,
      paymentAttemptId: order.paymentAttemptId,
      customerId: order.customerId,
      salesChannelId: order.salesChannelId,
      status: order.status,
      currency: order.currency,
      subtotal: order.subtotal,
      discount: order.discount,
      shippingCost: order.shippingCost,
      tax: order.tax,
      grandTotal: order.grandTotal,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku,
        productName: item.productName,
        variantName: item.variantName,
        productImage: item.productImage,
        price: item.price,
        weight: item.weight,
        quantity: item.quantity,
        subtotal: item.subtotal,
        currency: item.currency,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async createFromCheckoutSession({ paymentAttemptId }) {
    const startedAt = Date.now();
    let orderNumber = '';
    let checkoutNumber = '';
    let paymentAttemptNumber = '';

    try {
      if (!paymentAttemptId) {
        throw new OrderError({
          message: 'paymentAttemptId is required.',
          statusCode: 400,
          code: 'ORDER_PAYMENT_ATTEMPT_REQUIRED',
        });
      }

      const paymentAttempt = await this.paymentAttemptService.getPaymentAttemptById(paymentAttemptId);
      paymentAttemptNumber = paymentAttempt.attemptNumber;

      if (paymentAttempt.status !== 'PAID') {
        throw new OrderError({
          message: 'Payment attempt is not ready for order creation.',
          statusCode: 400,
          code: 'ORDER_PAYMENT_ATTEMPT_INVALID_STATUS',
        });
      }

      const existingOrder = await this.prisma.order.findFirst({
        where: {
          OR: [
            { paymentAttemptId: paymentAttempt.id },
            { checkoutSessionId: paymentAttempt.checkoutSessionId },
          ],
        },
        include: { items: true },
      });

      if (existingOrder) {
        logOrderCreation({
          orderNumber: existingOrder.orderNumber,
          checkoutNumber,
          paymentAttemptNumber,
          durationMs: Date.now() - startedAt,
          validationResult: 'REUSED',
        });
        return this.buildOrderResponse(existingOrder);
      }

      const checkoutSession = await this.checkoutService.getCheckoutSessionById(paymentAttempt.checkoutSessionId);
      checkoutNumber = checkoutSession.checkoutNumber;

      orderNumber = await this.generateOrderNumber();

      const order = await this.prisma.order.create({
        data: {
          id: this.idGenerator(),
          orderNumber,
          checkoutSessionId: checkoutSession.id,
          paymentAttemptId: paymentAttempt.id,
          customerId: checkoutSession.customer.id,
          salesChannelId: checkoutSession.salesChannel.id,
          status: ORDER_STATUS,
          currency: checkoutSession.currency,
          subtotal: checkoutSession.totals.subtotal,
          discount: checkoutSession.totals.discount,
          shippingCost: checkoutSession.totals.shippingCost,
          tax: checkoutSession.totals.tax,
          grandTotal: checkoutSession.totals.grandTotal,
          items: {
            create: checkoutSession.items.map((item) => ({
              id: this.idGenerator(),
              productId: item.productId,
              variantId: item.variantId,
              sku: item.sku,
              productName: item.productName,
              variantName: item.variantName,
              productImage: item.productImage || '',
              price: item.price,
              weight: item.weight || 0,
              quantity: item.quantity ?? item.qty,
              subtotal: item.subtotal,
              currency: item.currency || checkoutSession.currency,
            })),
          },
        },
        include: { items: true },
      });

      logOrderCreation({
        orderNumber: order.orderNumber,
        checkoutNumber,
        paymentAttemptNumber,
        durationMs: Date.now() - startedAt,
        validationResult: 'CREATED',
      });

      return this.buildOrderResponse(order);
    } catch (error) {
      logOrderCreation({
        orderNumber,
        checkoutNumber,
        paymentAttemptNumber,
        durationMs: Date.now() - startedAt,
        validationResult: 'FAILED',
      });
      throw error;
    }
  }
}

export const orderService = new OrderService();
