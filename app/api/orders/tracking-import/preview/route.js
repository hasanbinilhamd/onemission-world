import * as XLSX from 'xlsx';
import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { prisma } from '@/lib/prisma';
import { FULFILLMENT_STATUS, getSynchronizedFulfillmentStatus } from '@/lib/order/lifecycle';

const REQUIRED_COLUMNS = ['Tracking Number'];
const OPTIONAL_COLUMNS = ['Order ID', 'Order Number', 'Order Date', 'Customer', 'Courier', 'Service', 'Shipping Date & Time', 'Shipping Date', 'Actual Shipping Cost'];
const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];
const TRACKING_TEMPLATE_SHEET_NAME = 'Tracking Template';
const SHIPPING_DATE_FORMAT_HINT = 'Use DD-MM-YYYY HH:mm format, for example 16-08-2026 14:30.';
const BUSINESS_TIMEZONE_OFFSET_MINUTES = 7 * 60;

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

function pad2(value) {
  return String(value).padStart(2, '0');
}

function normalizeYear(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return NaN;
  return numeric < 100 ? 2000 + numeric : numeric;
}

function isValidDateParts(day, month, year) {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function buildBusinessDateTimeIso(day, month, year, hour = 0, minute = 0) {
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, 0) - (BUSINESS_TIMEZONE_OFFSET_MINUTES * 60 * 1000);
  return new Date(timestamp).toISOString();
}

function parseDateTimeParts(dayValue, monthValue, yearValue, hourValue = 0, minuteValue = 0) {
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = normalizeYear(yearValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (!isValidDateParts(day, month, year)) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return buildBusinessDateTimeIso(day, month, year, hour, minute);
}

function parseExcelSerialDate(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) return null;
  return parseDateTimeParts(parsed.d, parsed.m, parsed.y, parsed.H || 0, parsed.M || 0);
}

function parseShippingDateText(value) {
  const normalized = normalizeCell(value).replace(/^'/, '');
  if (!normalized) return { value: '', error: '' };

  const dayFirstDateTime = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (dayFirstDateTime) {
    const parsed = parseDateTimeParts(dayFirstDateTime[1], dayFirstDateTime[2], dayFirstDateTime[3], dayFirstDateTime[4], dayFirstDateTime[5]);
    return parsed ? { value: parsed, error: '' } : { value: '', error: SHIPPING_DATE_FORMAT_HINT };
  }

  const isoDateTime = normalized.match(/^\d{4}-\d{2}-\d{2}[T\s]/);
  if (isoDateTime) {
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime())
      ? { value: '', error: SHIPPING_DATE_FORMAT_HINT }
      : { value: parsed.toISOString(), error: '' };
  }

  return { value: '', error: SHIPPING_DATE_FORMAT_HINT };
}

function normalizeDateCell(value) {
  if (!value) return { value: '', error: '' };
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? { value: '', error: SHIPPING_DATE_FORMAT_HINT }
      : { value: value.toISOString(), error: '' };
  }
  if (typeof value === 'number') {
    const parsed = parseExcelSerialDate(value);
    return parsed ? { value: parsed, error: '' } : { value: '', error: SHIPPING_DATE_FORMAT_HINT };
  }
  return parseShippingDateText(value);
}

function validateRequiredColumns(headers) {
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    return `Required column missing: ${missing.join(', ')}`;
  }
  if (!headers.includes('Order ID') && !headers.includes('Order Number')) {
    return 'Required column missing: Order ID or Order Number';
  }
  return '';
}

function getCellDisplayValue(cell) {
  if (!cell) return '';
  if (cell.t === 's' || cell.t === 'str' || cell.t === 'inlineStr') return normalizeCell(cell.v);
  if (cell.w !== undefined && cell.w !== null) return normalizeCell(cell.w);
  if (cell.v !== undefined && cell.v !== null) return normalizeCell(cell.v);
  return '';
}

function getShippingDateCellValue(cell) {
  if (!cell) return '';
  if (cell.t === 'n' && typeof cell.v === 'number') {
    const parsed = XLSX.SSF.parse_date_code(cell.v);
    if (parsed) return `${pad2(parsed.d)}-${pad2(parsed.m)}-${parsed.y} ${pad2(parsed.H || 0)}:${pad2(parsed.M || 0)}`;
  }
  if (cell.t === 'd' && cell.v instanceof Date) return cell.v;
  return getCellDisplayValue(cell);
}

function parseWorksheetRows(worksheet) {
  if (!worksheet?.['!ref']) return [];
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const headerRow = range.s.r;
  const headers = [];

  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const address = XLSX.utils.encode_cell({ r: headerRow, c: columnIndex });
    const header = normalizeHeader(getCellDisplayValue(worksheet[address]));
    if (header) headers.push({ header, columnIndex });
  }

  const rows = [];
  for (let rowIndex = headerRow + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const row = {};
    let hasContent = false;

    headers.forEach(({ header, columnIndex }) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[address];
      const value = header === 'Shipping Date' || header === 'Shipping Date & Time' ? getShippingDateCellValue(cell) : getCellDisplayValue(cell);
      row[header] = value;

      if (header === 'Tracking Number' && cell?.t === 'n') {
        row.__trackingNumberWasNumeric = true;
      }
      if (normalizeCell(value)) {
        hasContent = true;
      }
    });

    if (hasContent) rows.push(row);
  }

  return rows;
}

function parseCsv(content) {
  const workbook = XLSX.read(content, { type: 'string', raw: false });
  const [sheetName] = workbook.SheetNames;
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
}

function parseWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false });
  const sheetName = workbook.SheetNames.includes(TRACKING_TEMPLATE_SHEET_NAME)
    ? TRACKING_TEMPLATE_SHEET_NAME
    : workbook.SheetNames[0];
  if (!sheetName) return [];
  return parseWorksheetRows(workbook.Sheets[sheetName]);
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
      actualShippingCost: true,
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
  const orderNumber = normalizeCell(row['Order ID'] || row['Order Number']);
  const trackingNumber = normalizeCell(row['Tracking Number']);
  const courier = normalizeCell(row.Courier);
  const service = normalizeCell(row.Service);
  const shippingDateResult = normalizeDateCell(row['Shipping Date & Time'] || row['Shipping Date']);
  const shippingDate = shippingDateResult.value;
  const actualShippingCostRaw = normalizeCell(row['Actual Shipping Cost']);
  const actualShippingCost = actualShippingCostRaw ? Number(actualShippingCostRaw) : null;
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
  if (actualShippingCostRaw && (!Number.isFinite(actualShippingCost) || actualShippingCost < 0)) {
    return { rowNumber, orderId: order.id, orderNumber, trackingNumber, status: 'invalid', reason: 'Actual Shipping Cost must be a numeric amount greater than or equal to 0.' };
  }
  if (!trackingNumber) {
    return { rowNumber, orderId: order.id, orderNumber, trackingNumber, status: 'invalid', reason: 'Tracking number is required.' };
  }
  if (row.__trackingNumberWasNumeric) {
    return {
      rowNumber,
      orderId: order.id,
      orderNumber,
      trackingNumber,
      status: 'invalid',
      reason: 'Tracking Number must be stored as text to prevent Excel removing leading zeros. Use the exported template, format the cell as Text, or prefix the value with an apostrophe.',
    };
  }
  if (duplicateTrackingNumbers.has(trackingNumber)) {
    return { rowNumber, orderId: order.id, orderNumber, trackingNumber, status: 'invalid', reason: 'Duplicate tracking number in import file.' };
  }
  if (shippingDateResult.error) {
    return {
      rowNumber,
      orderId: order.id,
      orderNumber,
      trackingNumber,
      status: 'invalid',
      reason: `Shipping Date format is invalid. ${shippingDateResult.error}`,
    };
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
    actualShippingCost,
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

      const headers = Object.keys(parsedRows[0] || {}).map(normalizeHeader).filter((header) => !header.startsWith('__'));
      const missingColumnMessage = validateRequiredColumns(headers);
      if (missingColumnMessage) {
        return NextResponse.json({ error: missingColumnMessage }, { status: 400 });
      }

      const canonicalRows = parsedRows.map((row) => {
        const nextRow = {};
        ALL_COLUMNS.forEach((column) => {
          nextRow[column] = row[column] ?? '';
        });
        nextRow.__trackingNumberWasNumeric = Boolean(row.__trackingNumberWasNumeric);
        return nextRow;
      });
      const orderNumbers = canonicalRows.map((row) => normalizeCell(row['Order ID'] || row['Order Number']));
      const trackingNumbers = canonicalRows.map((row) => normalizeCell(row['Tracking Number']));
      const duplicateOrderNumbers = buildDuplicateSet(orderNumbers);
      const duplicateTrackingNumbers = buildDuplicateSet(trackingNumbers);
      const orderMap = await buildOrderMap(orderNumbers);

      const rows = canonicalRows.map((row, index) => validateRow({
        row,
        rowNumber: index + 2,
        order: orderMap.get(normalizeCell(row['Order ID'] || row['Order Number'])),
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
