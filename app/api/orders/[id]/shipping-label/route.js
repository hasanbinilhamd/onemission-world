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

function buildError(message, status = 400, code = 'SHIPPING_LABEL_ERROR') {
  return NextResponse.json({ error: message, code }, { status });
}

export async function GET(request, { params }) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: { orderBy: [{ createdAt: 'asc' }] },
      },
    });

    if (!order) {
      return buildError('Order was not found.', 404, 'ORDER_NOT_FOUND');
    }

    if (!isShippingLabelEligible(order)) {
      return buildError('Shipping label is not ready. Create a Biteship shipment and make sure AWB/tracking number is available first.', 409, 'SHIPPING_LABEL_NOT_READY');
    }

    const pdf = await buildShippingLabelsPdfBuffer([order], { format: 'barcode' });
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${buildShippingLabelFilename()}"`,
        'Cache-Control': 'no-store',
        'X-Printable-Count': '1',
        'X-Rejected-Count': '0',
        'X-Label-Format': '80x100mm-barcode',
      },
    });
  });
}
