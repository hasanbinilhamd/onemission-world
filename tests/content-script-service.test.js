import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContentScriptSummary,
  buildStoredPdfPayload,
  resolveContentScriptMonthKey,
  validateContentScriptPayload,
} from '../lib/content-script/service.js';

const SAMPLE_PDF_DATA_URL = 'data:application/pdf;base64,JVBERi0xLjQK';

test('resolveContentScriptMonthKey supports explicit month and year filters', () => {
  const result = resolveContentScriptMonthKey({ month: '7', year: '2026' });

  assert.deepEqual(result, {
    year: '2026',
    month: '07',
    monthKey: '2026-07',
  });
});

test('buildStoredPdfPayload validates pdf files and returns unique filename', () => {
  const result = buildStoredPdfPayload({
    originalFilename: 'Campaign Brief.pdf',
    mimeType: 'application/pdf',
    dataUrl: SAMPLE_PDF_DATA_URL,
  });

  assert.equal(result.pdfUrl, SAMPLE_PDF_DATA_URL);
  assert.match(result.pdfFilename, /^campaign-brief-[a-f0-9-]+\.pdf$/);
  assert.ok(result.pdfByteSize > 0);
});

test('validateContentScriptPayload requires title, category, date, and pdf file when creating', () => {
  assert.equal(
    validateContentScriptPayload({ title: '', category: 'Campaign', calendarDate: '2026-07-13', pdfFile: {} }, { requirePdf: true }),
    'Title is required.',
  );
  assert.equal(
    validateContentScriptPayload({ title: 'Launch', category: '', calendarDate: '2026-07-13', pdfFile: {} }, { requirePdf: true }),
    'Category is required.',
  );
  assert.equal(
    validateContentScriptPayload({ title: 'Launch', category: 'Campaign', calendarDate: '', pdfFile: {} }, { requirePdf: true }),
    'Calendar date is required.',
  );
  assert.equal(
    validateContentScriptPayload({ title: 'Launch', category: 'Campaign', calendarDate: '2026-07-13' }, { requirePdf: true }),
    'PDF file is required.',
  );
  assert.equal(
    validateContentScriptPayload({ title: 'Launch', category: 'Campaign', calendarDate: '2026-07-13', pdfFile: {} }, { requirePdf: true }),
    null,
  );
});

test('buildContentScriptSummary calculates dashboard friendly metrics', () => {
  const items = [
    { category: 'Campaign', calendarDate: '2026-07-13' },
    { category: 'Article', calendarDate: '2026-07-14' },
    { category: 'Campaign', calendarDate: '2026-07-20' },
  ];

  const result = buildContentScriptSummary(items, new Date('2026-07-13T08:00:00Z'));

  assert.deepEqual(result, {
    totalFiles: 3,
    scheduledThisWeek: 2,
    campaignCount: 2,
    articleCount: 1,
  });
});
