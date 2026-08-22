import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getBiteshipConfig } from '@/lib/shipping/biteship';

const MM_TO_PT = 72 / 25.4;
const LABEL_WIDTH = 80 * MM_TO_PT;
const LABEL_HEIGHT = 100 * MM_TO_PT;
const PAGE_MARGIN = 7.4;
const BLACK = rgb(0, 0, 0);
const MUTED = rgb(0.29, 0.33, 0.39);
const LIGHT_LINE = rgb(0.82, 0.84, 0.87);

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

function yFromTop(topY, height = 0) {
  return LABEL_HEIGHT - topY - height;
}

function drawText(page, text, x, topY, size, font, options = {}) {
  const color = options.color || BLACK;
  const maxWidth = options.width || LABEL_WIDTH;
  let value = normalizeString(text);
  while (font.widthOfTextAtSize(value, size) > maxWidth && value.length > 1) {
    value = `${value.slice(0, -2)}…`;
  }
  page.drawText(value, { x, y: yFromTop(topY, size), size, font, color });
}

function drawCenteredText(page, text, x, topY, width, size, font, options = {}) {
  const value = normalizeString(text);
  const textWidth = font.widthOfTextAtSize(value, size);
  drawText(page, value, x + Math.max(0, (width - textWidth) / 2), topY, size, font, options);
}

function wrapText(text, width, size, font, maxLines = 3) {
  const words = normalizeString(text).replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > width && current) {
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

function drawLine(page, x1, topY1, x2, topY2, color = BLACK, thickness = 1) {
  page.drawLine({
    start: { x: x1, y: yFromTop(topY1) },
    end: { x: x2, y: yFromTop(topY2) },
    color,
    thickness,
  });
}

function drawRect(page, x, topY, width, height, options = {}) {
  page.drawRectangle({
    x,
    y: yFromTop(topY, height),
    width,
    height,
    borderColor: options.borderColor || BLACK,
    borderWidth: options.borderWidth ?? 1,
    color: options.color,
  });
}

function toCode128Codes(value) {
  const text = normalizeString(value);
  const codes = [104];
  for (const char of text) {
    const ascii = char.charCodeAt(0);
    if (ascii < 32 || ascii > 127) continue;
    codes.push(ascii - 32);
  }
  let checksum = codes[0];
  for (let index = 1; index < codes.length; index += 1) checksum += codes[index] * index;
  codes.push(checksum % 103);
  codes.push(106);
  return codes;
}

function drawCode128(page, value, x, topY, width, height) {
  const codes = toCode128Codes(value);
  const totalModules = codes.reduce((sum, code) => sum + CODE128_PATTERNS[code].split('').reduce((inner, widthValue) => inner + Number(widthValue), 0), 0);
  const moduleWidth = width / totalModules;
  let cursor = x;
  const y = yFromTop(topY, height);
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let index = 0; index < pattern.length; index += 1) {
      const segmentWidth = Number(pattern[index]) * moduleWidth;
      if (index % 2 === 0) {
        page.drawRectangle({ x: cursor, y, width: segmentWidth, height, color: BLACK, borderWidth: 0 });
      }
      cursor += segmentWidth;
    }
  }
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

async function embedPngIfExists(pdfDoc, fileName) {
  const imagePath = getPublicImagePath(fileName);
  if (!imagePath) return null;
  return pdfDoc.embedPng(fs.readFileSync(imagePath));
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

function drawImageFit(page, image, x, topY, boxWidth, boxHeight, { align = 'center' } = {}) {
  if (!image) return;
  const imageRatio = image.width / image.height;
  const boxRatio = boxWidth / boxHeight;
  let width = boxWidth;
  let height = boxHeight;
  if (imageRatio > boxRatio) height = width / imageRatio;
  else width = height * imageRatio;

  const offsetX = align === 'left'
    ? 0
    : align === 'right'
      ? Math.max(0, boxWidth - width)
      : Math.max(0, (boxWidth - width) / 2);

  page.drawImage(image, {
    x: x + offsetX,
    y: yFromTop(topY + (boxHeight - height) / 2, height),
    width,
    height,
  });
}

function drawKeyValueMeta(page, order, x, topY, width, height, fonts) {
  const columns = [0.34, 0.18, 0.22, 0.26];
  const labels = [
    ['ORDER', order.publicOrderNumber || order.orderNumber || '-'],
    ['WEIGHT', getTotalWeight(order)],
    ['ITEMS', `${getTotalItems(order)} pcs`],
    ['METHOD', 'Pickup'],
  ];
  drawRect(page, x, topY, width, height);
  let cursor = x;
  labels.forEach(([label, value], index) => {
    const colWidth = width * columns[index];
    if (index > 0) drawLine(page, cursor, topY, cursor, topY + height);
    drawText(page, label, cursor + 2, topY + 2, 4.3, fonts.bold, { color: MUTED, width: colWidth - 4 });
    drawText(page, truncateText(value, 22), cursor + 2, topY + 10, 5.5, fonts.bold, { width: colWidth - 4 });
    cursor += colWidth;
  });
}

function drawItems(page, order, x, topY, width, fonts) {
  drawText(page, 'ITEMS', x, topY, 5.6, fonts.bold, { width: 30 });
  drawText(page, `${getTotalItems(order)} pcs`, x + width - 28, topY, 5.2, fonts.bold, { width: 28 });
  const items = order.items || [];
  const maxLines = 3;
  let cursorY = topY + 8;
  items.slice(0, maxLines).forEach((item) => {
    const itemLabel = truncateText([item.productName, item.variantName].filter(Boolean).join(' · '), 46);
    drawLine(page, x, cursorY - 1, x + width, cursorY - 1, LIGHT_LINE, 0.4);
    drawText(page, itemLabel, x, cursorY, 5.3, fonts.regular, { width: width - 18 });
    drawText(page, `x${Number(item.quantity || 0)}`, x + width - 16, cursorY, 5.3, fonts.bold, { width: 16 });
    cursorY += 8;
  });
  if (items.length > maxLines) drawText(page, `+ ${items.length - maxLines} more item(s)`, x, cursorY + 1, 5.2, fonts.bold, { color: rgb(0.22, 0.25, 0.32), width });
}

function drawShippingLabelPage({ page, order, fonts, logoImage, courierLogoImage, format = 'barcode' }) {
  const x = PAGE_MARGIN;
  const width = LABEL_WIDTH - PAGE_MARGIN * 2;
  const courier = order.shipmentCourier || order.courier || '';
  const service = order.shipmentService || order.courierService || '';
  const trackingNumber = order.trackingNumber || '';
  const routingCode = resolveRoutingCode(order) || 'ROUTE';
  const config = getBiteshipConfig();
  const senderLine = [config.origin.organization || 'OneMission', config.origin.contactPhone].filter(Boolean).join(' · ');
  const senderAddress = [config.origin.address, config.origin.postalCode].filter(Boolean).join(' ');

  if (logoImage) drawImageFit(page, logoImage, x, 5, 112, 23, { align: 'left' });
  else drawText(page, 'ONEMISSION', x, 9, 13, fonts.bold, { width: 112 });
  drawText(page, `SHIPPING LABEL · ${routingCode}`, x, 25, 4.8, fonts.bold, { color: MUTED, width: 110 });

  drawRect(page, LABEL_WIDTH - PAGE_MARGIN - 58, 7, 58, 22);
  if (courierLogoImage) drawImageFit(page, courierLogoImage, LABEL_WIDTH - PAGE_MARGIN - 53, 10, 48, 12);
  else drawCenteredText(page, courier.toUpperCase(), LABEL_WIDTH - PAGE_MARGIN - 53, 10, 48, 10, fonts.bold);
  drawCenteredText(page, service.toUpperCase(), LABEL_WIDTH - PAGE_MARGIN - 53, 22, 48, 5.4, fonts.bold);
  drawLine(page, x, 33, x + width, 33);

  drawCenteredText(page, 'AWB / TRACKING NUMBER', x, 38, width, 4.8, fonts.bold, { color: MUTED });
  drawCode128(page, trackingNumber, x + 7, 46, width - 14, 31);
  drawCenteredText(page, trackingNumber, x, 81, width, 10, fonts.bold);
  drawLine(page, x, 98, x + width, 98);

  drawText(page, 'TO / RECIPIENT', x, 103, 5.6, fonts.bold, { width });
  drawText(page, truncateText(order.recipientName || order.customerName || '-', 38), x, 112, 8.2, fonts.bold, { width });
  drawText(page, truncateText(order.recipientPhone || order.customerPhone || '-', 38), x, 123, 6.5, fonts.bold, { width });
  wrapText(buildAddress(order), width, 5.55, fonts.regular, 3).forEach((line, index) => {
    drawText(page, line, x, 133 + index * 7, 5.55, fonts.regular, { width });
  });
  drawLine(page, x, 153, x + width, 153);

  drawItems(page, order, x, 158, width, fonts);
  drawLine(page, x, 202, x + width, 202);

  drawText(page, 'FROM / SENDER', x, 207, 5.6, fonts.bold, { width });
  drawText(page, truncateText(senderLine || 'OneMission', 52), x, 216, 6.4, fonts.bold, { width });
  drawText(page, truncateText(senderAddress || 'Katapang, Kab. Bandung, Jawa Barat', 88), x, 225, 5.0, fonts.regular, { width });
  drawLine(page, x, 238, x + width, 238);

  drawKeyValueMeta(page, order, x, 245, width, 25, fonts);
}

export function isShippingLabelEligible(order) {
  const normalizedProvider = String(order?.shippingProvider || '').trim().toLowerCase();
  return normalizedProvider === 'biteship'
    && Boolean(String(order?.shippingProviderOrderId || '').trim())
    && Boolean(String(order?.trackingNumber || '').trim())
    && String(order?.status || '').trim().toUpperCase() !== 'CANCELLED';
}

export async function buildShippingLabelsPdfBuffer(orders, { format = 'barcode' } = {}) {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
  const logoImage = await embedPngIfExists(pdfDoc, 'onemission-logo.png');
  const courierLogoCache = new Map();

  for (const order of orders) {
    const courier = order.shipmentCourier || order.courier || '';
    const courierLogoFile = getCourierLogoFile(courier);
    if (!courierLogoCache.has(courierLogoFile)) courierLogoCache.set(courierLogoFile, await embedPngIfExists(pdfDoc, courierLogoFile));
    const page = pdfDoc.addPage([LABEL_WIDTH, LABEL_HEIGHT]);
    drawShippingLabelPage({
      page,
      order,
      fonts,
      logoImage,
      courierLogoImage: courierLogoCache.get(courierLogoFile),
      format,
    });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export function buildShippingLabelFilename() {
  return `onemission-shipping-labels-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
}
