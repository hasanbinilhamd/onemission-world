import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { normalizeOrderError, orderService } from '@/lib/order';
import { getSynchronizedFulfillmentStatus, FULFILLMENT_STATUS } from '@/lib/order/lifecycle';
import { biteshipShipmentService, getBiteshipConfig } from '@/lib/shipping/biteship';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

function getWebhookSecretFromRequest(request) {
  const url = new URL(request.url);
  const authorization = request.headers.get('authorization') || '';
  return request.headers.get('x-biteship-webhook-secret')
    || request.headers.get('x-webhook-secret')
    || (authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '')
    || url.searchParams.get('secret')
    || '';
}

function verifyWebhookRequest(request) {
  const config = getBiteshipConfig();
  if (!config.webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, status: 500, error: 'Biteship webhook secret is not configured.' };
    }
    return { ok: true };
  }

  const providedSecret = getWebhookSecretFromRequest(request);
  if (providedSecret !== config.webhookSecret) {
    return { ok: false, status: 401, error: 'Biteship webhook signature is invalid.' };
  }

  return { ok: true };
}

async function applyFulfillmentTransition({ order, fulfillmentStatus, payload }) {
  if (!fulfillmentStatus) return null;

  const currentFulfillmentStatus = getSynchronizedFulfillmentStatus({
    orderStatus: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
  });

  const commonPayload = {
    updatedBy: 'Biteship Webhook',
    shipmentCourier: payload.courier_company || payload.courier?.company || order.shipmentCourier || order.courier || '',
    shipmentService: payload.courier_type || payload.courier?.type || order.shipmentService || order.courierService || '',
    trackingNumber: payload.courier_waybill_id || payload.courier?.waybill_id || order.trackingNumber || '',
    shippingDate: order.shippingDate || new Date().toISOString(),
    actualShippingCost: payload.order_price ?? payload.price ?? payload.shippment_fee ?? payload.shipment_fee ?? order.actualShippingCost ?? undefined,
  };

  if (fulfillmentStatus === FULFILLMENT_STATUS.READY_TO_SHIP) {
    if (currentFulfillmentStatus === FULFILLMENT_STATUS.PACKING) {
      return orderService.updateFulfillmentStatus({
        orderId: order.id,
        fulfillmentStatus: FULFILLMENT_STATUS.READY_TO_SHIP,
        updatedBy: commonPayload.updatedBy,
        notes: `Biteship status synchronized: ${payload.status || ''}`,
      });
    }
    return null;
  }

  if (fulfillmentStatus === FULFILLMENT_STATUS.SHIPPED) {
    if (currentFulfillmentStatus === FULFILLMENT_STATUS.PACKING) {
      await orderService.updateFulfillmentStatus({
        orderId: order.id,
        fulfillmentStatus: FULFILLMENT_STATUS.READY_TO_SHIP,
        updatedBy: commonPayload.updatedBy,
        notes: `Biteship status synchronized before dispatch: ${payload.status || ''}`,
      });
    }
    if ([FULFILLMENT_STATUS.PACKING, FULFILLMENT_STATUS.READY_TO_SHIP].includes(currentFulfillmentStatus)) {
      return orderService.updateFulfillmentStatus({
        orderId: order.id,
        fulfillmentStatus: FULFILLMENT_STATUS.SHIPPED,
        notes: `Biteship shipment picked up / in transit.\nStatus: ${payload.status || ''}`,
        ...commonPayload,
      });
    }
    return null;
  }

  if (fulfillmentStatus === FULFILLMENT_STATUS.DELIVERED) {
    let latestStatus = currentFulfillmentStatus;
    if (latestStatus === FULFILLMENT_STATUS.PACKING) {
      await orderService.updateFulfillmentStatus({
        orderId: order.id,
        fulfillmentStatus: FULFILLMENT_STATUS.READY_TO_SHIP,
        updatedBy: commonPayload.updatedBy,
        notes: `Biteship status synchronized before delivery: ${payload.status || ''}`,
      });
      latestStatus = FULFILLMENT_STATUS.READY_TO_SHIP;
    }
    if (latestStatus === FULFILLMENT_STATUS.READY_TO_SHIP) {
      await orderService.updateFulfillmentStatus({
        orderId: order.id,
        fulfillmentStatus: FULFILLMENT_STATUS.SHIPPED,
        notes: `Biteship shipment in transit before delivery.\nStatus: ${payload.status || ''}`,
        ...commonPayload,
      });
      latestStatus = FULFILLMENT_STATUS.SHIPPED;
    }
    if (latestStatus === FULFILLMENT_STATUS.SHIPPED) {
      return orderService.updateFulfillmentStatus({
        orderId: order.id,
        fulfillmentStatus: FULFILLMENT_STATUS.DELIVERED,
        updatedBy: commonPayload.updatedBy,
        notes: `Biteship shipment delivered.\nStatus: ${payload.status || ''}`,
      });
    }
  }

  return null;
}

function isEmptyWebhookValidationPayload(payload) {
  return !payload || (typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).length === 0);
}

export async function POST(request) {
  return withDevTiming(request, async () => {
    const payload = await request.json().catch(() => ({}));

    if (isEmptyWebhookValidationPayload(payload)) {
      console.info('[BiteshipWebhook]', {
        eventName: 'Biteship Webhook Validation Ping',
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, validation: true });
    }

    const verification = verifyWebhookRequest(request);
    if (!verification.ok) {
      console.warn('[BiteshipWebhook]', {
        eventName: 'Biteship Webhook Rejected',
        reason: verification.error,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ error: verification.error }, { status: verification.status });
    }

    try {
      const result = await biteshipShipmentService.updateFromWebhook(payload);
      const fulfillmentUpdate = await applyFulfillmentTransition({
        order: result.order,
        fulfillmentStatus: result.fulfillmentStatus,
        payload,
      });

      return NextResponse.json({
        success: true,
        event: payload.event || '',
        providerStatus: result.providerStatus,
        fulfillmentStatus: result.fulfillmentStatus,
        orderId: result.order.id,
        updated: Boolean(fulfillmentUpdate),
      });
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
