import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { getBiteshipConfig } from '@/lib/shipping/biteship';

const MM_TO_PT = 72 / 25.4;
const LABEL_WIDTH = 80 * MM_TO_PT;
const LABEL_HEIGHT = 100 * MM_TO_PT;
const PAGE_MARGIN = 7.4;
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

function normalizeString(value) {
  return String(value || '').trim();
}

function truncateText(value = '', maxLength = 64) {
  const normalized = normalizeString(value).replace(/\s+/g, ' ');
  return normalized.length > maxLength ? `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : normalized;
}

function wrapText(doc, text, width, options = {}) {
  const words = normalizeString(text).replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  const maxLines = options.maxLines || 3;
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (doc.widthOfString(candidate) > width && current) {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[lines.length - 1] = truncateText(lines[lines.length - 1], Math.max(12, lines[lines.length - 1].length - 2));
  }
  return lines;
}

function toCode128Codes(value) {
  const text = normalizeString(value);
  const codes = [104]; // Start Code B
  for (const char of text) {
    const ascii = char.charCodeAt(0);
    if (ascii < 32 || ascii > 127) continue;
    codes.push(ascii - 32);
  }
  let checksum = codes[0];
  for (let index = 1; index < codes.length; index += 1) {
    checksum += codes[index] * index;
  }
  codes.push(checksum % 103);
  codes.push(106);
  return codes;
}

function drawCode128(doc, value, x, y, width, height) {
  const codes = toCode128Codes(value);
  const totalModules = codes.reduce((sum, code) => sum + CODE128_PATTERNS[code].split('').reduce((inner, widthValue) => inner + Number(widthValue), 0), 0);
  const moduleWidth = width / totalModules;
  let cursor = x;
  doc.save().fillColor('black');
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let index = 0; index < pattern.length; index += 1) {
      const segmentWidth = Number(pattern[index]) * moduleWidth;
      if (index % 2 === 0) {
        doc.rect(cursor, y, segmentWidth, height).fill();
      }
      cursor += segmentWidth;
    }
  }
  doc.restore();
}

function getCourierLogoFile(courier = '') {
  const normalized = normalizeString(courier).toLowerCase();
  if (normalized.includes('jne')) return 'jne-logo.png';
  if (normalized.includes('jnt') || normalized.includes('j&t')) return 'jnt-logo.png';
  if (normalized.includes('lion')) return 'lion-parcel-logo.png';
  return '';
}

function getPublicImagePath(fileName) {
  if (!fileName) return '';
  const imagePath = path.join(process.cwd(), 'public', fileName);
  return fs.existsSync(imagePath) ? imagePath : '';
}

function buildAddress(order) {
  return [order.streetAddress, order.districtName, order.cityName, order.provinceName, order.postalCode].filter(Boolean).join(', ');
}

function resolveRoutingCode(order) {
  return normalizeString(
    order.shippingProviderPayload?.response?.courier?.routing_code
    || order.shippingProviderPayload?.lastWebhook?.courier_routing_code
    || order.shippingProviderPayload?.lastWebhook?.routing_code
    || '',
  );
}

function getTotalItems(order) {
  return (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function getTotalWeight(order) {
  const weight = (order.items || []).reduce((sum, item) => sum + (Number(item.weight || 0) * Number(item.quantity || 0)), 0);
  const fallback = Number(process.env.BITESHIP_DEFAULT_ITEM_WEIGHT_GRAMS || 200) * Math.max(1, getTotalItems(order));
  const grams = weight > 0 ? weight : fallback;
  return grams >= 1000 ? `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 1)} kg` : `${grams} g`;
}

function drawKeyValueMeta(doc, order, x, y, width, height) {
  const columns = [0.34, 0.18, 0.22, 0.26];
  const labels = [
    ['ORDER', order.publicOrderNumber || order.orderNumber || '-'],
    ['WEIGHT', getTotalWeight(order)],
    ['ITEMS', `${getTotalItems(order)} pcs`],
    ['METHOD', 'Pickup'],
  ];
  doc.rect(x, y, width, height).stroke();
  let cursor = x;
  labels.forEach(([label, value], index) => {
    const colWidth = width * columns[index];
    if (index > 0) doc.moveTo(cursor, y).lineTo(cursor, y + height).stroke();
    doc.font('Helvetica-Bold').fontSize(4.3).fillColor('#4b5563').text(label, cursor + 2, y + 2, { width: colWidth - 4, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(5.5).fillColor('black').text(truncateText(value, 22), cursor + 2, y + 10, { width: colWidth - 4, lineBreak: false });
    cursor += colWidth;
  });
}

function drawItems(doc, order, x, y, width, height) {
  doc.font('Helvetica-Bold').fontSize(5.6).fillColor('black').text('ITEMS', x, y, { continued: true });
  doc.font('Helvetica-Bold').fontSize(5.2).text(`  ${getTotalItems(order)} pcs`, { align: 'right', width });
  const items = order.items || [];
  const maxLines = 3;
  let cursorY = y + 8;
  items.slice(0, maxLines).forEach((item) => {
    const itemLabel = truncateText([item.productName, item.variantName].filter(Boolean).join(' · '), 46);
    doc.moveTo(x, cursorY - 1).lineTo(x + width, cursorY - 1).strokeColor('#d1d5db').lineWidth(0.4).stroke().strokeColor('black').lineWidth(1);
    doc.font('Helvetica').fontSize(5.3).fillColor('black').text(itemLabel, x, cursorY, { width: width - 18, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(5.3).text(`x${Number(item.quantity || 0)}`, x + width - 16, cursorY, { width: 16, align: 'right', lineBreak: false });
    cursorY += 8;
  });
  if (items.length > maxLines) {
    doc.font('Helvetica-Bold').fontSize(5.2).fillColor('#374151').text(`+ ${items.length - maxLines} more item(s)`, x, cursorY + 1, { width });
  }
}

function drawShippingLabelPage(doc, order, { format = 'barcode' } = {}) {
  const x = PAGE_MARGIN;
  const width = LABEL_WIDTH - PAGE_MARGIN * 2;
  const courier = order.shipmentCourier || order.courier || '';
  const service = order.shipmentService || order.courierService || '';
  const trackingNumber = order.trackingNumber || '';
  const routingCode = resolveRoutingCode(order) || 'ROUTE';
  const logoPath = getPublicImagePath('onemission-logo.png');
  const courierLogoPath = getPublicImagePath(getCourierLogoFile(courier));
  const config = getBiteshipConfig();
  const senderLine = [config.origin.organization || 'OneMission', config.origin.contactPhone].filter(Boolean).join(' · ');
  const senderAddress = [config.origin.address, config.origin.postalCode].filter(Boolean).join(' ');

  doc.lineWidth(1).strokeColor('black').fillColor('black');

  // Header 0-24 pt
  if (logoPath) {
    doc.image(logoPath, x, 8, { fit: [92, 17], align: 'left', valign: 'center' });
  } else {
    doc.font('Helvetica-Bold').fontSize(11).text('ONEMISSION', x, 10, { width: 96, lineBreak: false });
  }
  doc.font('Helvetica-Bold').fontSize(4.8).fillColor('#4b5563').text(`SHIPPING LABEL · ${routingCode}`, x, 24, { width: 110, lineBreak: false });
  doc.roundedRect(LABEL_WIDTH - PAGE_MARGIN - 58, 7, 58, 22, 4).stroke();
  if (courierLogoPath) {
    doc.image(courierLogoPath, LABEL_WIDTH - PAGE_MARGIN - 53, 10, { fit: [48, 12], align: 'center', valign: 'center' });
  } else {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text(courier.toUpperCase(), LABEL_WIDTH - PAGE_MARGIN - 53, 10, { width: 48, align: 'center', lineBreak: false });
  }
  doc.font('Helvetica-Bold').fontSize(5.4).fillColor('black').text(service.toUpperCase(), LABEL_WIDTH - PAGE_MARGIN - 53, 22, { width: 48, align: 'center', lineBreak: false });
  doc.moveTo(x, 33).lineTo(x + width, 33).stroke();

  // Tracking 35-96 pt
  doc.font('Helvetica-Bold').fontSize(4.8).fillColor('#4b5563').text('AWB / TRACKING NUMBER', x, 38, { width, align: format === 'barcode' ? 'center' : 'left', lineBreak: false });
  if (format === 'barcode') {
    drawCode128(doc, trackingNumber, x + 7, 46, width - 14, 31);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text(trackingNumber, x, 81, { width, align: 'center', lineBreak: false });
  } else {
    // QR placeholder path is intentionally not implemented here yet; use barcode default in production.
    drawCode128(doc, trackingNumber, x + 7, 46, width - 14, 31);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text(trackingNumber, x, 81, { width, align: 'center', lineBreak: false });
  }
  doc.moveTo(x, 98).lineTo(x + width, 98).stroke();

  // Recipient 100-151 pt
  doc.font('Helvetica-Bold').fontSize(5.6).text('TO / RECIPIENT', x, 103, { width, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(8.2).text(truncateText(order.recipientName || order.customerName || '-', 38), x, 112, { width, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(6.5).text(truncateText(order.recipientPhone || order.customerPhone || '-', 38), x, 123, { width, lineBreak: false });
  doc.font('Helvetica').fontSize(5.55);
  wrapText(doc, buildAddress(order), width, { maxLines: 3 }).forEach((line, index) => {
    doc.text(line, x, 133 + index * 7, { width, lineBreak: false });
  });
  doc.moveTo(x, 153).lineTo(x + width, 153).stroke();

  // Items 155-200 pt
  drawItems(doc, order, x, 158, width, 40);
  doc.moveTo(x, 202).lineTo(x + width, 202).stroke();

  // Sender 204-235 pt
  doc.font('Helvetica-Bold').fontSize(5.6).text('FROM / SENDER', x, 207, { width, lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(6.4).text(truncateText(senderLine || 'OneMission', 52), x, 216, { width, lineBreak: false });
  doc.font('Helvetica').fontSize(5.0).text(truncateText(senderAddress || 'Katapang, Kab. Bandung, Jawa Barat', 88), x, 225, { width, lineBreak: false });
  doc.moveTo(x, 238).lineTo(x + width, 238).stroke();

  // Footer meta
  drawKeyValueMeta(doc, order, x, 245, width, 25);
}

export function isShippingLabelEligible(order) {
  const normalizedProvider = String(order?.shippingProvider || '').trim().toLowerCase();
  return normalizedProvider === 'biteship'
    && Boolean(String(order?.shippingProviderOrderId || '').trim())
    && Boolean(String(order?.trackingNumber || '').trim())
    && String(order?.status || '').trim().toUpperCase() !== 'CANCELLED';
}

export async function buildShippingLabelsPdfBuffer(orders, { format = 'barcode' } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [LABEL_WIDTH, LABEL_HEIGHT],
      margin: 0,
      autoFirstPage: false,
      info: {
        Title: 'OneMission Shipping Labels',
        Author: 'OneMission',
      },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    orders.forEach((order) => {
      doc.addPage({ size: [LABEL_WIDTH, LABEL_HEIGHT], margin: 0 });
      drawShippingLabelPage(doc, order, { format });
    });

    doc.end();
  });
}

export function buildShippingLabelFilename() {
  return `onemission-shipping-labels-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
}
