import * as XLSX from 'xlsx';
import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { prisma } from '@/lib/prisma';

function normalizeOrderIds(value = '') {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildFileDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildWorkbookBuffer(orders) {
  const rows = orders.map((order) => ({
    'Order Number': order.publicOrderNumber || order.orderNumber,
    'Order Date': order.createdAt ? new Date(order.createdAt).toISOString() : '',
    Customer: order.customerName || '',
    Courier: order.shipmentCourier || order.courier || '',
    Service: order.shipmentService || order.courierService || '',
    'Tracking Number': order.trackingNumber || '',
    'Shipping Date': order.shippingDate ? new Date(order.shippingDate).toISOString() : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 26 },
    { wch: 28 },
    { wch: 16 },
    { wch: 18 },
    { wch: 24 },
    { wch: 26 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tracking Template');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    const url = new URL(request.url);
    const orderIds = normalizeOrderIds(url.searchParams.get('orderIds') || '');
    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'At least one order is required to export a tracking template.' }, { status: 400 });
    }

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        orderNumber: true,
        publicOrderNumber: true,
        createdAt: true,
        customerName: true,
        courier: true,
        courierService: true,
        shipmentCourier: true,
        shipmentService: true,
        trackingNumber: true,
        shippingDate: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const orderPosition = new Map(orderIds.map((id, index) => [id, index]));
    orders.sort((left, right) => (orderPosition.get(left.id) ?? 0) - (orderPosition.get(right.id) ?? 0));

    const workbookBuffer = buildWorkbookBuffer(orders);
    return new NextResponse(workbookBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="onemission-tracking-template-${buildFileDate()}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
