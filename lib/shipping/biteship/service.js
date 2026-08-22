import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import { FULFILLMENT_STATUS, getSynchronizedFulfillmentStatus } from '@/lib/order/lifecycle';
import { OrderError } from '@/lib/order/errors';
import { BiteshipApiError, BiteshipClient, biteshipClient } from './client';
import {
  BITESHIP_ACTIVE_CANCEL_ALLOWED_STATUSES,
  BITESHIP_ORDER_STATUS,
  BITESHIP_SHIPPING_PROVIDER,
  MANUAL_SHIPPING_PROVIDER,
  getBiteshipConfig,
  getBiteshipCourierMapping,
} from './config';

const BITESHIP_TIMELINE_EVENT = 'BITESHIP_SHIPMENT_STATUS';
const BITESHIP_CANCEL_TIMELINE_EVENT = 'BITESHIP_SHIPMENT_CANCELLED';

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePostalCode(value) {
  const normalized = normalizeString(value).replace(/\D/g, '');
  return normalized ? Number(normalized) : null;
}

function isPaidOrder(order) {
  return String(order?.paymentAttempt?.status || '').trim().toUpperCase() === 'PAID';
}

function isBiteshipOrder(order) {
  const providerOrderId = normalizeString(order?.shippingProviderOrderId);
  return normalizeLower(order?.shippingProvider) === BITESHIP_SHIPPING_PROVIDER
    && Boolean(providerOrderId)
    && !providerOrderId.startsWith('creating-');
}

function buildAddress(order) {
  return [
    order.streetAddress,
    order.districtName,
    order.cityName,
    order.provinceName,
    order.postalCode,
  ].map(normalizeString).filter(Boolean).join(', ');
}

function validateShipmentEligibility(order) {
  if (!order?.id) {
    throw new OrderError({ message: 'Order was not found.', statusCode: 404, code: 'ORDER_NOT_FOUND' });
  }
  if (!isPaidOrder(order)) {
    throw new OrderError({ message: 'Only paid orders can create Biteship shipments.', statusCode: 409, code: 'BITESHIP_ORDER_NOT_PAID' });
  }
  const fulfillmentStatus = getSynchronizedFulfillmentStatus({ orderStatus: order.status, fulfillmentStatus: order.fulfillmentStatus });
  if (fulfillmentStatus !== FULFILLMENT_STATUS.PACKING) {
    throw new OrderError({ message: 'Order must be in Packing before creating a Biteship shipment.', statusCode: 409, code: 'BITESHIP_ORDER_NOT_PACKING' });
  }
  if (String(order.status || '').trim().toUpperCase() === 'CANCELLED') {
    throw new OrderError({ message: 'Cancelled orders cannot create Biteship shipments.', statusCode: 409, code: 'BITESHIP_ORDER_CANCELLED' });
  }
  if (order.shippingProviderOrderId) {
    throw new OrderError({ message: 'This order already has a Biteship shipment.', statusCode: 409, code: 'BITESHIP_SHIPMENT_ALREADY_EXISTS' });
  }
}

function validateOriginConfig(origin) {
  const missing = [];
  if (!origin.contactName) missing.push('BITESHIP_ORIGIN_CONTACT_NAME');
  if (!origin.contactPhone) missing.push('BITESHIP_ORIGIN_CONTACT_PHONE');
  if (!origin.address) missing.push('BITESHIP_ORIGIN_ADDRESS');
  if (!origin.postalCode && !origin.areaId) missing.push('BITESHIP_ORIGIN_POSTAL_CODE or BITESHIP_ORIGIN_AREA_ID');
  if (missing.length > 0) {
    throw new OrderError({
      message: `Biteship origin configuration is incomplete: ${missing.join(', ')}.`,
      statusCode: 400,
      code: 'BITESHIP_ORIGIN_CONFIG_INCOMPLETE',
    });
  }
}

function validateDestination(order) {
  const missing = [];
  if (!order.recipientName) missing.push('recipientName');
  if (!order.recipientPhone) missing.push('recipientPhone');
  if (!buildAddress(order)) missing.push('streetAddress');
  if (!order.postalCode && !order.shippingDestinationId) missing.push('postalCode or shippingDestinationId');
  if (missing.length > 0) {
    throw new OrderError({
      message: `Order destination is incomplete for Biteship: ${missing.join(', ')}.`,
      statusCode: 400,
      code: 'BITESHIP_DESTINATION_INCOMPLETE',
    });
  }
}

function buildBiteshipItems(order, config) {
  const items = Array.isArray(order.items) ? order.items : [];
  if (items.length === 0) {
    throw new OrderError({ message: 'Order items are required for Biteship shipment.', statusCode: 400, code: 'BITESHIP_ORDER_ITEMS_REQUIRED' });
  }

  return items.map((item) => {
    const quantity = Math.max(1, normalizeNumber(item.quantity, 1));
    const value = Math.max(1, normalizeNumber(item.price || (Number(item.subtotal || 0) / quantity), 1));
    return {
      name: normalizeString(item.productName || item.sku || 'OneMission Product').slice(0, 120),
      description: normalizeString(item.variantName || item.sku || item.productName || '').slice(0, 240),
      sku: normalizeString(item.sku) || null,
      category: 'fashion',
      value,
      quantity,
      weight: Math.max(1, normalizeNumber(item.weight, config.defaultItemWeightGrams)),
      length: Math.max(1, config.defaultItemLengthCm),
      width: Math.max(1, config.defaultItemWidthCm),
      height: Math.max(1, config.defaultItemHeightCm),
    };
  });
}

function buildCreateOrderPayload({ order, courierCompany = '', courierType = '', config }) {
  validateOriginConfig(config.origin);
  validateDestination(order);

  const originPostalCode = normalizePostalCode(config.origin.postalCode);
  const destinationPostalCode = normalizePostalCode(order.postalCode);
  const destinationProviderId = normalizeString(order.shippingDestinationId);
  const destinationAreaId = destinationProviderId && !destinationProviderId.startsWith('postal:') ? destinationProviderId : '';
  const payload = {
    shipper_contact_name: config.origin.contactName,
    shipper_contact_phone: config.origin.contactPhone,
    shipper_contact_email: config.origin.contactEmail || undefined,
    shipper_organization: config.origin.organization || 'OneMission',
    origin_contact_name: config.origin.contactName,
    origin_contact_phone: config.origin.contactPhone,
    origin_contact_email: config.origin.contactEmail || undefined,
    origin_address: config.origin.address,
    origin_note: config.origin.note || undefined,
    origin_collection_method: config.origin.collectionMethod || 'pickup',
    destination_contact_name: order.recipientName,
    destination_contact_phone: order.recipientPhone,
    destination_contact_email: order.customerEmail || undefined,
    destination_address: buildAddress(order),
    ...(destinationAreaId ? { destination_area_id: destinationAreaId } : { destination_postal_code: destinationPostalCode }),
    courier_company: courierCompany,
    courier_type: courierType,
    delivery_type: 'now',
    order_note: `OneMission ${order.publicOrderNumber || order.orderNumber}`,
    reference_id: order.id,
    metadata: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      publicOrderNumber: order.publicOrderNumber,
    },
    items: buildBiteshipItems(order, config),
  };

  if (originPostalCode) payload.origin_postal_code = originPostalCode;
  if (config.origin.areaId) payload.origin_area_id = config.origin.areaId;

  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  return payload;
}

export function normalizeBiteshipOrderResponse(payload = {}) {
  const courier = payload.courier || {};
  return {
    providerOrderId: normalizeString(payload.id || payload.order_id),
    providerTrackingId: normalizeString(courier.tracking_id || payload.courier_tracking_id || payload.tracking_id),
    waybillId: normalizeString(courier.waybill_id || payload.courier_waybill_id || payload.waybill_id),
    courierCompany: normalizeString(courier.company || payload.courier_company),
    courierType: normalizeString(courier.type || payload.courier_type),
    status: normalizeLower(payload.status || courier.status),
    actualShippingCost: normalizeNumber(courier.shipment_fee ?? payload.shippment_fee ?? payload.shipment_fee ?? payload.price ?? payload.order_price, null),
    labelUrl: normalizeString(payload.label_url || payload.shipping_label_url || payload.waybill_url || courier.label_url || courier.waybill_url),
    trackingUrl: normalizeString(courier.link || payload.courier_link),
    raw: payload,
  };
}

export function mapBiteshipStatusToFulfillmentStatus(status) {
  const normalized = normalizeLower(status).replace(/[-\s]+/g, '_');
  const readyStatuses = new Set(['confirmed', 'scheduled', 'allocated']);
  const shippedStatuses = new Set(['picking_up', 'pickup', 'picked', 'dropping_off', 'in_transit', 'on_process', 'courier_departed']);
  const deliveredStatuses = new Set(['delivered', 'completed']);

  if (readyStatuses.has(normalized)) return FULFILLMENT_STATUS.READY_TO_SHIP;
  if (shippedStatuses.has(normalized)) return FULFILLMENT_STATUS.SHIPPED;
  if (deliveredStatuses.has(normalized)) return FULFILLMENT_STATUS.DELIVERED;
  return null;
}

async function getOrder(orderId, prismaClient = prisma) {
  return prismaClient.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      paymentAttempt: true,
      timelines: { orderBy: { createdAt: 'asc' } },
      returnRequest: true,
    },
  });
}

function buildTimelineData({ orderId, eventName, updatedBy, notes, nowFactory = () => new Date() }) {
  return {
    id: uuid(),
    orderId,
    eventName,
    updatedBy: normalizeString(updatedBy) || 'Biteship',
    notes,
    createdAt: nowFactory(),
  };
}

export class BiteshipShipmentService {
  constructor({ prismaClient = prisma, client = biteshipClient, nowFactory = () => new Date() } = {}) {
    this.prisma = prismaClient;
    this.client = client;
    this.nowFactory = nowFactory;
  }

  async createShipment({ orderId, courierCompany = '', courierType = '', updatedBy = '' } = {}) {
    const order = await getOrder(orderId, this.prisma);
    validateShipmentEligibility(order);

    const mapping = getBiteshipCourierMapping({
      courier: order.shipmentCourier || order.courier,
      service: order.shipmentService || order.courierService,
      overrideCourier: courierCompany,
      overrideService: courierType,
    });
    if (!mapping.courierCompany || !mapping.courierType) {
      throw new OrderError({ message: 'Biteship courier company and service type are required.', statusCode: 400, code: 'BITESHIP_COURIER_MAPPING_REQUIRED' });
    }

    const config = getBiteshipConfig();
    const biteshipPayload = buildCreateOrderPayload({ order, courierCompany: mapping.courierCompany, courierType: mapping.courierType, config });

    const lock = await this.prisma.order.updateMany({
      where: {
        id: order.id,
        fulfillmentStatus: FULFILLMENT_STATUS.PACKING,
        shippingProviderOrderId: '',
      },
      data: {
        shippingProvider: BITESHIP_SHIPPING_PROVIDER,
        shippingProviderOrderId: `creating-${order.id}`,
        shippingProviderStatus: BITESHIP_ORDER_STATUS.CREATING,
        shippingProviderPayload: { request: biteshipPayload, mode: config.mode, phase: 'creating' },
      },
    });

    if (lock.count !== 1) {
      const latestOrder = await getOrder(order.id, this.prisma);
      if (isBiteshipOrder(latestOrder)) {
        return { order: latestOrder, action: 'FOUND', shipment: normalizeBiteshipOrderResponse(latestOrder.shippingProviderPayload?.response || {}) };
      }
      throw new OrderError({ message: 'Biteship shipment creation is already in progress or no longer allowed.', statusCode: 409, code: 'BITESHIP_SHIPMENT_LOCKED' });
    }

    let response;
    try {
      console.info('[BiteshipShipment]', {
        eventName: 'Biteship Shipment Create Requested',
        orderId: order.id,
        orderNumber: order.orderNumber,
        courier: mapping.courierCompany,
        service: mapping.courierType,
        mode: config.mode,
        timestamp: this.nowFactory().toISOString(),
      });
      response = await this.client.createOrder(biteshipPayload);
    } catch (error) {
      if (error instanceof BiteshipApiError && error.response?.details?.order_id) {
        response = await this.client.retrieveOrder(error.response.details.order_id);
      } else {
        console.warn('[BiteshipShipment]', {
          eventName: 'Biteship Shipment Create Failed',
          orderId: order.id,
          orderNumber: order.orderNumber,
          courier: mapping.courierCompany,
          service: mapping.courierType,
          code: error.code || '',
          statusCode: error.statusCode || 500,
          message: error.message,
          timestamp: this.nowFactory().toISOString(),
        });
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            shippingProvider: MANUAL_SHIPPING_PROVIDER,
            shippingProviderOrderId: '',
            shippingProviderStatus: BITESHIP_ORDER_STATUS.CREATE_FAILED,
            shippingProviderPayload: { request: biteshipPayload, error: { message: error.message, code: error.code || '' } },
          },
        });
        throw error;
      }
    }

    const shipment = normalizeBiteshipOrderResponse(response);
    if (!shipment.providerOrderId) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          shippingProvider: MANUAL_SHIPPING_PROVIDER,
          shippingProviderOrderId: '',
          shippingProviderStatus: BITESHIP_ORDER_STATUS.CREATE_FAILED,
          shippingProviderPayload: { request: biteshipPayload, response, error: { code: 'BITESHIP_ORDER_ID_MISSING' } },
        },
      });
      throw new OrderError({ message: 'Biteship did not return a shipment order ID.', statusCode: 502, code: 'BITESHIP_ORDER_ID_MISSING' });
    }

    const savedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        shippingProvider: BITESHIP_SHIPPING_PROVIDER,
        shippingProviderOrderId: shipment.providerOrderId,
        shippingProviderTrackingId: shipment.providerTrackingId,
        shippingProviderStatus: shipment.status || BITESHIP_ORDER_STATUS.CONFIRMED,
        shippingProviderStatusAt: this.nowFactory(),
        shippingLabelUrl: shipment.labelUrl,
        shipmentCourier: shipment.courierCompany || mapping.courierCompany,
        shipmentService: shipment.courierType || mapping.courierType,
        trackingNumber: shipment.waybillId || order.trackingNumber || '',
        actualShippingCost: shipment.actualShippingCost ?? order.actualShippingCost ?? null,
        shippingProviderPayload: { request: biteshipPayload, response },
      },
      include: { items: true, paymentAttempt: true, timelines: { orderBy: { createdAt: 'asc' } }, returnRequest: true },
    });

    await this.prisma.orderTimeline.create({
      data: buildTimelineData({
        orderId: order.id,
        eventName: BITESHIP_TIMELINE_EVENT,
        updatedBy: updatedBy || 'HQ Admin',
        notes: `Biteship shipment created.\nProvider Order ID: ${shipment.providerOrderId}\nCourier: ${shipment.courierCompany || mapping.courierCompany}\nService: ${shipment.courierType || mapping.courierType}\nAWB: ${shipment.waybillId || 'Pending'}\nActual Shipping Cost: ${shipment.actualShippingCost ?? 'Pending'}`,
        nowFactory: this.nowFactory,
      }),
    });

    console.info('[BiteshipShipment]', {
      eventName: 'Biteship Shipment Created',
      orderId: order.id,
      orderNumber: order.orderNumber,
      providerOrderId: shipment.providerOrderId,
      courier: shipment.courierCompany || mapping.courierCompany,
      service: shipment.courierType || mapping.courierType,
      status: shipment.status,
      timestamp: this.nowFactory().toISOString(),
    });

    return { order: savedOrder, action: response === undefined ? 'FOUND' : 'CREATED', shipment };
  }

  async updateFromWebhook(payload = {}) {
    const providerOrderId = normalizeString(payload.order_id || payload.id);
    const trackingId = normalizeString(payload.courier_tracking_id || payload.tracking_id);
    const waybillId = normalizeString(payload.courier_waybill_id || payload.waybill_id);
    if (!providerOrderId && !trackingId && !waybillId) {
      throw new OrderError({ message: 'Biteship webhook does not contain a shipment identifier.', statusCode: 400, code: 'BITESHIP_WEBHOOK_IDENTIFIER_MISSING' });
    }

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          providerOrderId ? { shippingProviderOrderId: providerOrderId } : null,
          trackingId ? { shippingProviderTrackingId: trackingId } : null,
          waybillId ? { trackingNumber: waybillId } : null,
        ].filter(Boolean),
      },
      include: { items: true, paymentAttempt: true, timelines: { orderBy: { createdAt: 'asc' } }, returnRequest: true },
    });

    if (!order) {
      throw new OrderError({ message: 'Biteship webhook order was not found.', statusCode: 404, code: 'BITESHIP_WEBHOOK_ORDER_NOT_FOUND' });
    }

    const normalized = normalizeBiteshipOrderResponse(payload);
    const nextStatus = normalized.status || normalizeLower(payload.status);
    const providerStatusChanged = nextStatus && nextStatus !== normalizeLower(order.shippingProviderStatus);
    const fulfillmentStatus = mapBiteshipStatusToFulfillmentStatus(nextStatus);

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          shippingProvider: BITESHIP_SHIPPING_PROVIDER,
          shippingProviderOrderId: providerOrderId || order.shippingProviderOrderId,
          shippingProviderTrackingId: trackingId || order.shippingProviderTrackingId,
          shippingProviderStatus: nextStatus || order.shippingProviderStatus,
          shippingProviderStatusAt: this.nowFactory(),
          trackingNumber: waybillId || order.trackingNumber,
          actualShippingCost: normalized.actualShippingCost ?? order.actualShippingCost ?? null,
          shipmentCourier: normalized.courierCompany || order.shipmentCourier || order.courier,
          shipmentService: normalized.courierType || order.shipmentService || order.courierService,
          shippingLabelUrl: normalized.labelUrl || order.shippingLabelUrl || '',
          shippingProviderPayload: { ...(order.shippingProviderPayload || {}), lastWebhook: payload },
        },
      });

      if (providerStatusChanged) {
        await tx.orderTimeline.create({
          data: buildTimelineData({
            orderId: order.id,
            eventName: nextStatus === BITESHIP_ORDER_STATUS.CANCELLED ? BITESHIP_CANCEL_TIMELINE_EVENT : BITESHIP_TIMELINE_EVENT,
            updatedBy: 'Biteship Webhook',
            notes: `Biteship webhook received.\nEvent: ${payload.event || 'order.status'}\nStatus: ${nextStatus}\nAWB: ${waybillId || order.trackingNumber || 'Pending'}`,
            nowFactory: this.nowFactory,
          }),
        });
      }

      return tx.order.findUnique({ where: { id: order.id }, include: { items: true, paymentAttempt: true, timelines: { orderBy: { createdAt: 'asc' } }, returnRequest: true } });
    });

    return { order: updatedOrder, fulfillmentStatus, providerStatus: nextStatus, payload };
  }

  async cancelShipmentForOrder(order, { updatedBy = 'HQ Admin' } = {}) {
    if (!isBiteshipOrder(order)) {
      return { action: 'SKIPPED', reason: 'NO_BITESHIP_SHIPMENT' };
    }

    let providerStatus = normalizeLower(order.shippingProviderStatus);
    if (!BITESHIP_ACTIVE_CANCEL_ALLOWED_STATUSES.has(providerStatus)) {
      throw new OrderError({
        message: 'Biteship shipment can no longer be cancelled. Please review the courier shipment before cancelling this order.',
        statusCode: 409,
        code: 'BITESHIP_SHIPMENT_CANCELLATION_NOT_ALLOWED',
      });
    }

    try {
      const remoteOrder = await this.client.retrieveOrder(order.shippingProviderOrderId);
      providerStatus = normalizeLower(remoteOrder.status) || providerStatus;
      if (!BITESHIP_ACTIVE_CANCEL_ALLOWED_STATUSES.has(providerStatus)) {
        throw new OrderError({
          message: 'Biteship shipment can no longer be cancelled. Please review the courier shipment before cancelling this order.',
          statusCode: 409,
          code: 'BITESHIP_SHIPMENT_CANCELLATION_NOT_ALLOWED',
        });
      }
    } catch (error) {
      if (error instanceof OrderError) throw error;
      throw new OrderError({
        message: 'Unable to verify Biteship shipment status before cancellation. Local order was not cancelled.',
        statusCode: error.statusCode || 502,
        code: 'BITESHIP_SHIPMENT_STATUS_CHECK_FAILED',
      });
    }

    const response = await this.client.cancelOrder(order.shippingProviderOrderId);
    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        shippingProviderStatus: BITESHIP_ORDER_STATUS.CANCELLED,
        shippingProviderStatusAt: this.nowFactory(),
        shippingProviderPayload: { ...(order.shippingProviderPayload || {}), cancellation: response },
      },
    });
    await this.prisma.orderTimeline.create({
      data: buildTimelineData({
        orderId: order.id,
        eventName: BITESHIP_CANCEL_TIMELINE_EVENT,
        updatedBy,
        notes: `Biteship shipment cancelled before local order cancellation.\nProvider Order ID: ${order.shippingProviderOrderId}`,
        nowFactory: this.nowFactory,
      }),
    });
    return { action: 'CANCELLED', response };
  }
}

export const biteshipShipmentService = new BiteshipShipmentService();
