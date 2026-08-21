import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { prisma } from '@/lib/prisma';
import {
  buildShippingLabelFilename,
  buildShippingLabelsPdfBuffer,
  isShippingLabelEligible,
} from '@/lib/shipping/label-pdf';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeOrderIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
}

export async function POST(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const orderIds = normalizeOrderIds(payload.orderIds);
    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'At least one selected order is required.', code: 'SHIPPING_LABEL_ORDER_REQUIRED' }, { status: 400 });
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        items: { orderBy: [{ createdAt: 'asc' }] },
      },
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
      if (!isShippingLabelEligible(order)) {
        rejected.push({
          orderId,
          orderNumber: order.orderNumber,
          publicOrderNumber: order.publicOrderNumber,
          reason: 'SHIPPING_LABEL_NOT_READY',
        });
        continue;
      }
      printable.push(order);
    }

    if (printable.length === 0) {
      return NextResponse.json({
        error: 'No selected orders are ready for shipping label printing. Biteship shipment and AWB are required.',
        code: 'SHIPPING_LABEL_NONE_READY',
        rejected,
      }, { status: 409 });
    }

    const pdf = await buildShippingLabelsPdfBuffer(printable, { format: 'barcode' });
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${buildShippingLabelFilename()}"`,
        'Cache-Control': 'no-store',
        'X-Printable-Count': String(printable.length),
        'X-Rejected-Count': String(rejected.length),
        'X-Label-Format': '80x100mm-barcode',
      },
    });
  });
}
