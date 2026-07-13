import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContentScriptSummary,
  buildStoredPdfPayload,
  normalizeContentScriptCategory,
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
    validateContentScriptPayload({ title: '', category: 'Community', calendarDate: '2026-07-13', pdfFile: {} }, { requirePdf: true }),
    'Title is required.',
  );
  assert.equal(
    validateContentScriptPayload({ title: 'Launch', category: '', calendarDate: '2026-07-13', pdfFile: {} }, { requirePdf: true }),
    'Category is required.',
  );
  assert.equal(
    validateContentScriptPayload({ title: 'Launch', category: 'Community', calendarDate: '', pdfFile: {} }, { requirePdf: true }),
    'Calendar date is required.',
  );
  assert.equal(
    validateContentScriptPayload({ title: 'Launch', category: 'Community', calendarDate: '2026-07-13' }, { requirePdf: true }),
    'PDF file is required.',
  );
  assert.equal(
    validateContentScriptPayload({ title: 'Launch', category: 'Community', calendarDate: '2026-07-13', pdfFile: {} }, { requirePdf: true }),
    null,
  );
});

test('normalizeContentScriptCategory maps legacy category values into content pillar categories', () => {
  assert.equal(normalizeContentScriptCategory('Instagram Feed'), 'Product');
  assert.equal(normalizeContentScriptCategory('Campaign'), 'Community');
  assert.equal(normalizeContentScriptCategory('Article'), 'Education');
  assert.equal(normalizeContentScriptCategory('Other'), 'Story');
  assert.equal(normalizeContentScriptCategory('Unknown Category'), 'Story');
});

test('buildContentScriptSummary calculates dashboard friendly metrics', () => {
  const items = [
    { category: 'Campaign', calendarDate: '2026-07-13' },
    { category: 'Article', calendarDate: '2026-07-14' },
    { category: 'Community', calendarDate: '2026-07-20' },
    { category: 'Proofen', calendarDate: '2026-07-15' },
    { category: 'Product', calendarDate: '2026-07-15' },
  ];

  const result = buildContentScriptSummary(items, new Date('2026-07-13T08:00:00Z'));

  assert.deepEqual(result, {
    totalFiles: 5,
    scheduledThisWeek: 4,
    storyCount: 0,
    educationCount: 1,
    proofenCount: 1,
    productCount: 1,
    communityCount: 2,
  });
});
