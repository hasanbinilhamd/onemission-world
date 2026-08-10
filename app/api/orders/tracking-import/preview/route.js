import * as XLSX from 'xlsx';
import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { prisma } from '@/lib/prisma';
import { FULFILLMENT_STATUS, getSynchronizedFulfillmentStatus } from '@/lib/order/lifecycle';

const REQUIRED_COLUMNS = ['Order Number', 'Tracking Number'];
const OPTIONAL_COLUMNS = ['Courier', 'Service', 'Shipping Date'];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, 'Order Date', 'Customer', ...OPTIONAL_COLUMNS];

function buildSummary(rows) {
  return {
    total: rows.length,
    valid: rows.filter((row) => row.status === 'valid').length,
    invalid: rows.filter((row) => row.status === 'invalid').length,
    skipped: rows.filter((row) => row.status === 'skipped').length,
  };
}

function normalizeHeader(value) {
  return String(value || '').trim();
}

function normalizeCell(value) {
  return String(value ?? '').trim();
}

function normalizeDateCell(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  const normalized = normalizeCell(value);
  if (!normalized) return '';
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString();
}

function validateRequiredColumns(headers) {
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    return `Required column missing: ${missing.join(', ')}`;
  }
  return '';
}

function parseCsv(content) {
  const workbook = XLSX.read(content, { type: 'string', raw: false });
  const [sheetName] = workbook.SheetNames;
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  const [sheetName] = workbook.SheetNames;
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
}

async function parseUploadedRows(file) {
  const fileName = String(file?.name || '').toLowerCase();
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.csv')) {
    throw new Error('Unsupported file format. Please upload .xlsx or .csv.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return fileName.endsWith('.csv') ? parseCsv(buffer.toString('utf8')) : parseWorkbook(buffer);
}

function buildDuplicateSet(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.filter(Boolean).forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return duplicates;
}

async function buildOrderMap(orderNumbers) {
  const uniqueOrderNumbers = [...new Set(orderNumbers.filter(Boolean))];
  if (uniqueOrderNumbers.length === 0) return new Map();

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { orderNumber: { in: uniqueOrderNumbers } },
        { publicOrderNumber: { in: uniqueOrderNumbers } },
      ],
    },
    select: {
      id: true,
      orderNumber: true,
      publicOrderNumber: true,
      status: true,
      fulfillmentStatus: true,
      courier: true,
      courierService: true,
      shipmentCourier: true,
      shipmentService: true,
      trackingNumber: true,
      shippingDate: true,
    },
  });

  const map = new Map();
  orders.forEach((order) => {
    map.set(order.orderNumber, order);
    map.set(order.publicOrderNumber, order);
  });
  return map;
}

function validateRow({ row, rowNumber, order, duplicateOrderNumbers, duplicateTrackingNumbers }) {
  const orderNumber = normalizeCell(row['Order Number']);
  const trackingNumber = normalizeCell(row['Tracking Number']);
  const courier = normalizeCell(row.Courier);
  const service = normalizeCell(row.Service);
  const shippingDate = normalizeDateCell(row['Shipping Date']);
  const warnings = [];

  if (!orderNumber) {
    return { rowNumber, orderNumber, trackingNumber, status: 'invalid', reason: 'Order Number is required.' };
  }
  if (duplicateOrderNumbers.has(orderNumber)) {
    return { rowNumber, orderNumber, trackingNumber, status: 'invalid', reason: 'Duplicate Order Number in import file.' };
  }
  if (!order) {
    return { rowNumber, orderNumber, trackingNumber, status: 'invalid', reason: 'Order not found.' };
  }
  if (!trackingNumber) {
    return { rowNumber, orderId: order.id, orderNumber, trackingNumber, status: 'invalid', reason: 'Tracking number is required.' };
  }
  if (duplicateTrackingNumbers.has(trackingNumber)) {
    return { rowNumber, orderId: order.id, orderNumber, trackingNumber, status: 'invalid', reason: 'Duplicate tracking number in import file.' };
  }

  const fulfillmentStatus = getSynchronizedFulfillmentStatus({
    orderStatus: order.status,
    fulfillmentStatus: order.fulfillmentStatus,
  });

  if (fulfillmentStatus === FULFILLMENT_STATUS.SHIPPED || fulfillmentStatus === FULFILLMENT_STATUS.DELIVERED) {
    return {
      rowNumber,
      orderId: order.id,
      orderNumber,
      trackingNumber,
      status: 'skipped',
      reason: 'Shipment information is locked after dispatch.',
      currentTrackingNumber: order.trackingNumber || '',
    };
  }

  if (fulfillmentStatus !== FULFILLMENT_STATUS.READY_TO_SHIP) {
    return {
      rowNumber,
      orderId: order.id,
      orderNumber,
      trackingNumber,
      status: 'invalid',
      reason: 'Order must be Ready To Ship before tracking information can be updated.',
      fulfillmentStatus,
    };
  }

  const resolvedCourier = order.shipmentCourier || order.courier || courier;
  const resolvedService = order.shipmentService || order.courierService || service;
  if (!resolvedCourier || !resolvedService) {
    return {
      rowNumber,
      orderId: order.id,
      orderNumber,
      trackingNumber,
      status: 'invalid',
      reason: 'Courier and Service are required before marking this order as shipped.',
    };
  }

  if (order.trackingNumber && order.trackingNumber !== trackingNumber) {
    warnings.push('Existing tracking number will be replaced.');
  }

  return {
    rowNumber,
    orderId: order.id,
    orderNumber,
    status: 'valid',
    trackingNumber,
    courier,
    service,
    shippingDate,
    currentTrackingNumber: order.trackingNumber || '',
    warnings,
  };
}

export async function POST(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    try {
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || typeof file.arrayBuffer !== 'function') {
        return NextResponse.json({ error: 'Please upload a tracking template file.' }, { status: 400 });
      }

      const parsedRows = await parseUploadedRows(file);
      if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
        return NextResponse.json({ error: 'The uploaded file does not contain any rows.' }, { status: 400 });
      }

      const headers = Object.keys(parsedRows[0] || {}).map(normalizeHeader);
      const missingColumnMessage = validateRequiredColumns(headers);
      if (missingColumnMessage) {
        return NextResponse.json({ error: missingColumnMessage }, { status: 400 });
      }

      const canonicalRows = parsedRows.map((row) => {
        const nextRow = {};
        ALL_COLUMNS.forEach((column) => {
          nextRow[column] = row[column] ?? '';
        });
        return nextRow;
      });
      const orderNumbers = canonicalRows.map((row) => normalizeCell(row['Order Number']));
      const trackingNumbers = canonicalRows.map((row) => normalizeCell(row['Tracking Number']));
      const duplicateOrderNumbers = buildDuplicateSet(orderNumbers);
      const duplicateTrackingNumbers = buildDuplicateSet(trackingNumbers);
      const orderMap = await buildOrderMap(orderNumbers);

      const rows = canonicalRows.map((row, index) => validateRow({
        row,
        rowNumber: index + 2,
        order: orderMap.get(normalizeCell(row['Order Number'])),
        duplicateOrderNumbers,
        duplicateTrackingNumbers,
      }));

      return NextResponse.json({
        success: true,
        summary: buildSummary(rows),
        rows,
      });
    } catch (error) {
      return NextResponse.json({ error: error.message || 'Import preview could not be generated.' }, { status: 400 });
    }
  });
}
