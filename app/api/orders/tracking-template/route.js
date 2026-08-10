import * as XLSX from 'xlsx';
import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { prisma } from '@/lib/prisma';

const TEMPLATE_HEADERS = ['Order Number', 'Order Date', 'Customer', 'Courier', 'Service', 'Tracking Number', 'Shipping Date'];
const TEXT_COLUMN_INDEXES = [0, 2, 3, 4, 5, 6];
const TRACKING_TEMPLATE_SHEET_NAME = 'Tracking Template';

function normalizeOrderIds(value = '') {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildFileDate() {
  return new Date().toISOString().slice(0, 10);
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatTemplateDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${pad2(partMap.day)}-${pad2(partMap.month)}-${partMap.year}`;
}

function ensureTextCell(worksheet, rowIndex, columnIndex, value = '') {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  worksheet[address] = {
    t: 's',
    v: String(value ?? ''),
    z: '@',
  };
}

function buildInstructionsSheet() {
  const rows = [
    ['Field', 'How to fill', 'Example'],
    ['Tracking Number', 'Always keep this column as Text so leading zeros are preserved.', '00088127637'],
    ['Shipping Date', 'Use DD-MM-YYYY format. Do not use MM-DD-YYYY.', '10-08-2026'],
    ['Courier / Service', 'Leave blank to use the existing order shipment details from HQ.', 'JNE / REG'],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 22 }, { wch: 70 }, { wch: 20 }];
  return worksheet;
}

function buildWorkbookBuffer(orders) {
  const rows = orders.map((order) => ([
    order.publicOrderNumber || order.orderNumber,
    order.createdAt ? new Date(order.createdAt).toISOString() : '',
    order.customerName || '',
    order.shipmentCourier || order.courier || '',
    order.shipmentService || order.courierService || '',
    order.trackingNumber || '',
    formatTemplateDate(order.shippingDate),
  ]));

  const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...rows]);
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 26 },
    { wch: 28 },
    { wch: 16 },
    { wch: 18 },
    { wch: 24 },
    { wch: 18 },
  ];
  worksheet['!autofilter'] = { ref: `A1:G${Math.max(rows.length + 1, 1)}` };
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };

  for (let rowIndex = 1; rowIndex <= rows.length; rowIndex += 1) {
    TEXT_COLUMN_INDEXES.forEach((columnIndex) => {
      ensureTextCell(worksheet, rowIndex, columnIndex, rows[rowIndex - 1][columnIndex]);
    });
  }

  worksheet.F1.c = [{ a: 'OneMission', t: 'Tracking Number is text. Example: 00088127637. Do not let Excel convert it to a number.' }];
  worksheet.G1.c = [{ a: 'OneMission', t: 'Shipping Date format: DD-MM-YYYY. Example: 10-08-2026.' }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, TRACKING_TEMPLATE_SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, buildInstructionsSheet(), 'Instructions');
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
