import { randomUUID } from 'crypto';
import {
  CONTENT_SCRIPT_ALLOWED_MIME_TYPES,
  CONTENT_SCRIPT_CATEGORY_OPTIONS,
  CONTENT_SCRIPT_MAX_FILE_SIZE_BYTES,
} from './constants';

function normalizeString(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeContentScriptCategory(category) {
  const normalizedCategory = normalizeString(category);
  return CONTENT_SCRIPT_CATEGORY_OPTIONS.includes(normalizedCategory)
    ? normalizedCategory
    : 'Other';
}

function isValidDateOnly(value) {
  const normalizedValue = normalizeString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return false;
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return parsedDate.toISOString().startsWith(normalizedValue);
}

function resolveContentScriptMonthKey({ month = '', year = '', legacyMonth = '' } = {}) {
  const normalizedLegacyMonth = normalizeString(legacyMonth);
  if (/^\d{4}-\d{2}$/.test(normalizedLegacyMonth)) {
    const [legacyYear, legacyMonthNumber] = normalizedLegacyMonth.split('-');
    return { year: legacyYear, month: legacyMonthNumber, monthKey: normalizedLegacyMonth };
  }

  const normalizedMonth = String(month ?? '').trim().padStart(2, '0');
  const normalizedYear = normalizeString(year);

  if (/^\d{4}$/.test(normalizedYear) && /^(0[1-9]|1[0-2])$/.test(normalizedMonth)) {
    return {
      year: normalizedYear,
      month: normalizedMonth,
      monthKey: `${normalizedYear}-${normalizedMonth}`,
    };
  }

  const now = new Date();
  const fallbackYear = String(now.getFullYear());
  const fallbackMonth = String(now.getMonth() + 1).padStart(2, '0');
  return {
    year: fallbackYear,
    month: fallbackMonth,
    monthKey: `${fallbackYear}-${fallbackMonth}`,
  };
}

function startOfWeek(date) {
  const value = new Date(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfWeek(date) {
  const value = startOfWeek(date);
  value.setDate(value.getDate() + 6);
  value.setHours(23, 59, 59, 999);
  return value;
}

function toDateOnly(date) {
  return new Date(date).toISOString().split('T')[0];
}

function buildContentScriptSummary(items = [], referenceDate = new Date()) {
  const currentWeekStart = toDateOnly(startOfWeek(referenceDate));
  const currentWeekEnd = toDateOnly(endOfWeek(referenceDate));

  return {
    totalFiles: items.length,
    scheduledThisWeek: items.filter((item) => {
      const calendarDate = normalizeString(item.calendarDate);
      return calendarDate >= currentWeekStart && calendarDate <= currentWeekEnd;
    }).length,
    campaignCount: items.filter((item) => item.category === 'Campaign').length,
    articleCount: items.filter((item) => item.category === 'Article').length,
  };
}

function sanitizePdfBaseName(fileName) {
  const normalizedName = normalizeString(fileName, 'content-script.pdf');
  const withoutExtension = normalizedName.replace(/\.pdf$/i, '') || 'content-script';
  return withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'content-script';
}

function createUniquePdfFilename(originalFilename) {
  const safeBaseName = sanitizePdfBaseName(originalFilename);
  return `${safeBaseName}-${randomUUID()}.pdf`;
}

function parsePdfDataUrl(dataUrl) {
  const normalizedDataUrl = normalizeString(dataUrl);
  const match = normalizedDataUrl.match(/^data:(application\/pdf);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) {
    throw new Error('Only PDF files are allowed.');
  }

  const mimeType = match[1].toLowerCase();
  const base64Payload = match[2].replace(/\s+/g, '');
  const fileBuffer = Buffer.from(base64Payload, 'base64');

  if (fileBuffer.length === 0) {
    throw new Error('Uploaded PDF file is empty.');
  }

  if (fileBuffer.length > CONTENT_SCRIPT_MAX_FILE_SIZE_BYTES) {
    throw new Error('PDF file size must be 20 MB or less.');
  }

  return {
    mimeType,
    byteLength: fileBuffer.length,
    normalizedDataUrl: `data:${mimeType};base64,${base64Payload}`,
  };
}

function buildStoredPdfPayload(payload = {}) {
  const mimeType = normalizeString(payload.mimeType).toLowerCase();
  if (!CONTENT_SCRIPT_ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error('Only PDF files are allowed.');
  }

  const originalFilename = normalizeString(payload.originalFilename || payload.fileName || 'content-script.pdf');
  if (!originalFilename.toLowerCase().endsWith('.pdf')) {
    throw new Error('Uploaded file must use the .pdf extension.');
  }

  const parsedPdf = parsePdfDataUrl(payload.dataUrl);
  return {
    pdfUrl: parsedPdf.normalizedDataUrl,
    pdfFilename: createUniquePdfFilename(originalFilename),
    pdfByteSize: parsedPdf.byteLength,
  };
}

function validateContentScriptPayload(payload = {}, { requirePdf = true } = {}) {
  const title = normalizeString(payload.title);
  if (!title) {
    return 'Title is required.';
  }

  if (!isValidDateOnly(payload.calendarDate)) {
    return 'Calendar date is required.';
  }

  const category = normalizeString(payload.category);
  if (!category || !CONTENT_SCRIPT_CATEGORY_OPTIONS.includes(category)) {
    return 'Category is required.';
  }

  if (requirePdf && !payload.pdfFile) {
    return 'PDF file is required.';
  }

  return null;
}

function sanitizeContentScriptPayload(payload = {}) {
  return {
    title: normalizeString(payload.title),
    category: normalizeContentScriptCategory(payload.category),
    calendarDate: normalizeString(payload.calendarDate),
    createdBy: normalizeString(payload.createdBy),
  };
}

export {
  buildContentScriptSummary,
  buildStoredPdfPayload,
  CONTENT_SCRIPT_ALLOWED_MIME_TYPES,
  CONTENT_SCRIPT_CATEGORY_OPTIONS,
  CONTENT_SCRIPT_MAX_FILE_SIZE_BYTES,
  normalizeContentScriptCategory,
  resolveContentScriptMonthKey,
  sanitizeContentScriptPayload,
  validateContentScriptPayload,
};
