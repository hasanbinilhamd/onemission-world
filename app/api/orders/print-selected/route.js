import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { prisma } from '@/lib/prisma';
import { FULFILLMENT_STATUS, getSynchronizedFulfillmentStatus } from '@/lib/order/lifecycle';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const CELL_WIDTH = A4_WIDTH / 2;
const CELL_HEIGHT = A4_HEIGHT / 4;
const CELL_PADDING = 12;

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

function escapePdfText(value = '') {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');
}

function formatPdfDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function truncateText(value = '', maxLength = 80) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : normalized;
}

function wrapText(value = '', maxChars = 45, maxLines = 3) {
  const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[lines.length - 1] = truncateText(lines[lines.length - 1], Math.max(8, maxChars - 1));
  }
  return lines;
}

function addText(commands, text, x, y, size = 8, options = {}) {
  const font = options.bold ? 'F2' : 'F1';
  commands.push(`BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`);
}

function addLine(commands, x1, y1, x2, y2) {
  commands.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
}

function addRect(commands, x, y, width, height) {
  commands.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
}

function drawSlip(commands, order, cellX, cellY) {
  const left = cellX + CELL_PADDING;
  const right = cellX + CELL_WIDTH - CELL_PADDING;
  let y = cellY + CELL_HEIGHT - CELL_PADDING - 10;

  addRect(commands, cellX, cellY, CELL_WIDTH, CELL_HEIGHT);
  addText(commands, 'ONEMISSION', left, y, 10, { bold: true });
  addText(commands, formatPdfDate(order.orderDate), right - 54, y, 6.5);
  y -= 12;
  addText(commands, `ORDER #${order.publicOrderNumber || order.orderNumber}`, left, y, 8.5, { bold: true });
  y -= 7;
  addLine(commands, left, y, right, y);
  y -= 12;

  const recipient = order.recipient || {};
  addText(commands, 'SHIP TO', left, y, 6.5, { bold: true });
  y -= 10;
  addText(commands, truncateText(recipient.name, 36), left, y, 8.5, { bold: true });
  y -= 9;
  addText(commands, truncateText(recipient.phone, 36), left, y, 7);
  y -= 9;
  for (const line of wrapText(recipient.address, 54, 3)) {
    addText(commands, line, left, y, 6.7);
    y -= 8;
  }
  y -= 2;

  addText(commands, 'ITEMS', left, y, 6.5, { bold: true });
  y -= 10;
  const maxItemLines = Math.max(1, Math.floor((y - cellY - 24) / 16));
  const visibleItems = (order.items || []).slice(0, maxItemLines);
  for (const item of visibleItems) {
    addText(commands, truncateText(item.productName, 42), left, y, 7.2, { bold: true });
    y -= 8;
    addText(commands, `${truncateText(item.variantName || 'Default', 38)} x ${item.quantity}`, left, y, 6.7);
    y -= 9;
  }
  if ((order.items || []).length > visibleItems.length) {
    addText(commands, `+ ${(order.items || []).length - visibleItems.length} more item(s)`, left, y, 6.5);
  }

  const footerY = cellY + CELL_PADDING;
  addLine(commands, left, footerY + 10, right, footerY + 10);
  addText(commands, `TOTAL ITEMS: ${order.totalItems}`, left, footerY, 6.7, { bold: true });
  const shipmentLabel = [order.shipment?.courier, order.shipment?.service].filter(Boolean).join(' / ');
  addText(commands, truncateText(shipmentLabel, 28), right - 92, footerY, 6.7, { bold: true });
}

function buildPdfPageContent(orders) {
  const commands = [
    'q',
    '0.82 w',
    '0 0 0 RG',
  ];
  Array.from({ length: 8 }).forEach((_, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const cellX = col * CELL_WIDTH;
    const cellY = A4_HEIGHT - (row + 1) * CELL_HEIGHT;
    const order = orders[index];
    if (order) {
      drawSlip(commands, order, cellX, cellY);
    } else {
      addRect(commands, cellX, cellY, CELL_WIDTH, CELL_HEIGHT);
    }
  });
  commands.push('Q');
  return commands.join('\n');
}

function buildPdfBuffer(orders) {
  const chunks = [];
  for (let index = 0; index < orders.length; index += 8) {
    chunks.push(orders.slice(index, index + 8));
  }

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds = [];

  for (const pageOrders of chunks) {
    const stream = buildPdfPageContent(pageOrders);
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, 'binary')} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${A4_WIDTH} ${A4_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'binary');
}

function buildFilename() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `onemission-packing-slips-${timestamp}.pdf`;
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

    const pdf = buildPdfBuffer(printable);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${buildFilename()}"`,
        'Cache-Control': 'no-store',
        'X-Printable-Count': String(printable.length),
        'X-Rejected-Count': String(rejected.length),
        'X-Eligible-Fulfillment-Status': FULFILLMENT_STATUS.PACKING,
      },
    });
  });
}
