import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { prisma } from '@/lib/prisma';
import { FULFILLMENT_STATUS, getSynchronizedFulfillmentStatus } from '@/lib/order/lifecycle';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildShippingAddress(order) {
  return [
    order.streetAddress,
    order.districtName,
    order.cityName,
    order.provinceName,
    order.postalCode,
  ].filter(Boolean).join(', ');
}

function buildPrintableOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    publicOrderNumber: order.publicOrderNumber,
    orderDate: order.createdAt,
    recipient: {
      name: order.recipientName || order.customerName || '',
      phone: order.recipientPhone || order.customerPhone || '',
      address: buildShippingAddress(order),
      cityName: order.cityName || '',
      provinceName: order.provinceName || '',
      postalCode: order.postalCode || '',
    },
    shipment: {
      courier: order.shipmentCourier || order.courier || '',
      service: order.shipmentService || order.courierService || '',
      trackingNumber: order.trackingNumber || '',
    },
    totalItems: (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    items: (order.items || []).map((item) => ({
      id: item.id,
      productName: item.productName,
      variantName: item.variantName,
      quantity: item.quantity,
    })),
  };
}

export async function POST(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const orderIds = Array.isArray(payload.orderIds)
      ? payload.orderIds.map((id) => String(id || '').trim()).filter(Boolean)
      : [];

    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'At least one selected order is required.' }, { status: 400 });
    }

    const uniqueOrderIds = [...new Set(orderIds)];
    const orders = await prisma.order.findMany({
      where: { id: { in: uniqueOrderIds } },
      include: { items: { orderBy: [{ createdAt: 'asc' }] } },
    });
    const orderMap = new Map(orders.map((order) => [order.id, order]));

    const printable = [];
    const rejected = [];

    for (const orderId of orderIds) {
      const order = orderMap.get(orderId);
      if (!order) {
        rejected.push({ orderId, reason: 'ORDER_NOT_FOUND' });
        continue;
      }

      const fulfillmentStatus = getSynchronizedFulfillmentStatus({
        orderStatus: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
      });

      if (fulfillmentStatus !== FULFILLMENT_STATUS.PACKING) {
        rejected.push({
          orderId,
          orderNumber: order.orderNumber,
          publicOrderNumber: order.publicOrderNumber,
          fulfillmentStatus,
          reason: 'ORDER_NOT_PACKING',
        });
        continue;
      }

      printable.push(buildPrintableOrder(order));
    }

    if (printable.length === 0) {
      return NextResponse.json({
        error: 'No selected orders are eligible for printing. Only PACKING orders can be printed.',
        printable,
        rejected,
      }, { status: 409 });
    }

    return NextResponse.json({
      printable,
      rejected,
      summary: {
        requested: orderIds.length,
        printable: printable.length,
        rejected: rejected.length,
        eligibleFulfillmentStatus: FULFILLMENT_STATUS.PACKING,
      },
    });
  });
}
