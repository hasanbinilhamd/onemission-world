import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { domainEventPublisher } from '@/lib/domain-events/publisher';
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
    paymentAttempt = paymentAttemptService,
    eventPublisher = domainEventPublisher,
    idGenerator = uuid,
    nowFactory = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.paymentAttemptService = paymentAttempt;
    this.eventPublisher = eventPublisher;
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
      paymentReference: order.paymentReference,
      customerId: order.customerId,
      customerCode: order.customerCode,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      salesChannelId: order.salesChannelId,
      salesChannelCode: order.salesChannelCode,
      salesChannelName: order.salesChannelName,
      shipping: {
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        originDistrict: order.originDistrict,
        destinationDistrict: order.destinationDistrict,
        courier: order.courier,
        courierService: order.courierService,
        shippingDescription: order.shippingDescription,
        estimatedDelivery: order.estimatedDelivery,
        provinceId: order.provinceId,
        provinceName: order.provinceName,
        cityId: order.cityId,
        cityName: order.cityName,
        districtId: order.districtId,
        districtName: order.districtName,
        postalCode: order.postalCode,
        streetAddress: order.streetAddress,
      },
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

  async getCheckoutSessionSnapshot(checkoutSessionId) {
    if (!checkoutSessionId) {
      throw new OrderError({
        message: 'checkoutSessionId is required.',
        statusCode: 400,
        code: 'ORDER_CHECKOUT_SESSION_REQUIRED',
      });
    }

    const checkoutSession = await this.prisma.checkoutSession.findUnique({
      where: { id: checkoutSessionId },
      include: { items: true },
    });

    if (!checkoutSession) {
      throw new OrderError({
        message: 'Checkout session was not found.',
        statusCode: 404,
        code: 'CHECKOUT_SESSION_NOT_FOUND',
      });
    }

    return checkoutSession;
  }

  async commitInventory(tx, checkoutSession) {
    for (const item of checkoutSession.items) {
      const quantity = Number(item.qty);
      const inventory = await tx.inventory.findUnique({ where: { id: item.variantId } });

      if (!inventory) {
        throw new OrderError({
          message: 'Inventory variant was not found.',
          statusCode: 404,
          code: 'ORDER_INVENTORY_NOT_FOUND',
        });
      }

      if ((inventory.status || 'Active') !== 'Active') {
        throw new OrderError({
          message: 'Inventory variant is inactive.',
          statusCode: 400,
          code: 'ORDER_INVENTORY_INACTIVE',
        });
      }

      if (inventory.quantity < quantity) {
        throw new OrderError({
          message: 'Inventory is insufficient for order commit.',
          statusCode: 409,
          code: 'ORDER_INVENTORY_INSUFFICIENT',
        });
      }

      await tx.inventory.update({
        where: { id: item.variantId },
        data: {
          quantity: inventory.quantity - quantity,
        },
      });
    }
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
          checkoutNumber: existingOrder.checkoutSessionId,
          paymentAttemptNumber,
          durationMs: Date.now() - startedAt,
          validationResult: 'REUSED',
        });
        return this.buildOrderResponse(existingOrder);
      }

      const checkoutSession = await this.getCheckoutSessionSnapshot(paymentAttempt.checkoutSessionId);
      checkoutNumber = checkoutSession.checkoutNumber;

      if (checkoutSession.status !== 'PAID') {
        throw new OrderError({
          message: 'Checkout session is not paid.',
          statusCode: 400,
          code: 'ORDER_CHECKOUT_INVALID_STATUS',
        });
      }

      orderNumber = await this.generateOrderNumber();

      const order = await this.prisma.$transaction(async (tx) => {
        await this.commitInventory(tx, checkoutSession);

        return tx.order.create({
          data: {
            id: this.idGenerator(),
            orderNumber,
            checkoutSessionId: checkoutSession.id,
            paymentAttemptId: paymentAttempt.id,
            paymentReference: paymentAttempt.providerReference || paymentAttempt.attemptNumber,
            customerId: checkoutSession.customerId,
            customerCode: checkoutSession.customerCode,
            customerName: checkoutSession.customerName,
            customerEmail: checkoutSession.customerEmail,
            customerPhone: checkoutSession.customerPhone,
            salesChannelId: checkoutSession.salesChannelId,
            salesChannelCode: checkoutSession.salesChannelCode,
            salesChannelName: checkoutSession.salesChannelName,
            recipientName: checkoutSession.recipientName,
            recipientPhone: checkoutSession.phone,
            originDistrict: checkoutSession.originDistrict,
            destinationDistrict: checkoutSession.destinationDistrict,
            courier: checkoutSession.courier,
            courierService: checkoutSession.courierService,
            shippingDescription: checkoutSession.shippingDescription,
            estimatedDelivery: checkoutSession.estimatedDelivery,
            provinceId: checkoutSession.provinceId,
            provinceName: checkoutSession.provinceName,
            cityId: checkoutSession.cityId,
            cityName: checkoutSession.cityName,
            districtId: checkoutSession.districtId,
            districtName: checkoutSession.districtName,
            postalCode: checkoutSession.postalCode,
            streetAddress: checkoutSession.streetAddress,
            status: ORDER_STATUS,
            currency: checkoutSession.currency,
            subtotal: checkoutSession.subtotal,
            discount: checkoutSession.discount,
            shippingCost: checkoutSession.shippingCost,
            tax: checkoutSession.tax,
            grandTotal: checkoutSession.grandTotal,
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
                quantity: item.qty,
                subtotal: item.subtotal,
                currency: item.currency || checkoutSession.currency,
              })),
            },
          },
          include: { items: true },
        });
      });

      await this.eventPublisher.publish('OrderCreated', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutSessionId: order.checkoutSessionId,
        paymentAttemptId: order.paymentAttemptId,
      });

      await this.eventPublisher.publish('InventoryCommitted', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        checkoutSessionId: order.checkoutSessionId,
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
