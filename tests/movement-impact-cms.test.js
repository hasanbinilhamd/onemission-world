import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  IMPACT_STATUS,
  IMPACT_CATEGORIES,
  IMPACT_STATUS_PRIORITY,
  sortImpactStoriesForPublic,
  slugifyTitle,
  normalizeImpactCategory,
  computeImpactReadingMinutes,
  validateImpactBlock,
} from '../lib/impact/rules.js';

/**
 * Movement Impact CMS — focused coverage.
 *  - pure business rules (ordering, slug, reading time, block validation)
 *  - schema/migration guarantees (slug unique, single featured, block order)
 *  - route wiring + draft protection (source-level)
 */

const schemaSource = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migrationSource = fs.readFileSync(
  new URL('../prisma/migrations/20260901130000_add_impact_cms/migration.sql', import.meta.url),
  'utf8',
);
const serviceSource = fs.readFileSync(new URL('../lib/impact/service.js', import.meta.url), 'utf8');
const publicListSource = fs.readFileSync(new URL('../app/api/movement/impact/route.js', import.meta.url), 'utf8');
const publicDetailSource = fs.readFileSync(new URL('../app/api/movement/impact/[slug]/route.js', import.meta.url), 'utf8');
const adminRouteSource = fs.readFileSync(new URL('../app/api/admin/movement/impact/route.js', import.meta.url), 'utf8');
const uploadRouteSource = fs.readFileSync(new URL('../app/api/admin/movement/impact/upload/route.js', import.meta.url), 'utf8');
const pageJsSource = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');

// ── Business rules ──────────────────────────────────────────────────────────

test('status priority ordering: NOW LIVE → COMING SOON → CLOSED (hard rule)', () => {
  assert.deepEqual(IMPACT_STATUS_PRIORITY, { NOW_LIVE: 0, COMING_SOON: 1, CLOSED: 2 });

  const items = [
    { status: 'CLOSED', featured: false, publishedAt: '2026-09-01', createdAt: 'a' },
    { status: 'NOW_LIVE', featured: false, publishedAt: '2026-01-01', createdAt: 'b' },
    { status: 'COMING_SOON', featured: true, publishedAt: '2026-06-01', createdAt: 'c' },
    { status: 'NOW_LIVE', featured: false, publishedAt: '2026-08-01', createdAt: 'd' },
  ];

  const sorted = sortImpactStoriesForPublic(items);
  assert.deepEqual(sorted.map((item) => item.status), ['NOW_LIVE', 'NOW_LIVE', 'COMING_SOON', 'CLOSED']);
});

test('featured only ranks within its own status — never above NOW LIVE', () => {
  const items = [
    { status: 'COMING_SOON', featured: true, publishedAt: '2026-09-01', createdAt: 'a' },
    { status: 'NOW_LIVE', featured: false, publishedAt: '2026-01-01', createdAt: 'b' },
  ];
  const sorted = sortImpactStoriesForPublic(items);
  assert.deepEqual(sorted.map((item) => item.status), ['NOW_LIVE', 'COMING_SOON']);
});

test('slugify produces lowercase hyphenated slugs', () => {
  assert.equal(slugifyTitle('Running Before Sunrise'), 'running-before-sunrise');
  assert.equal(slugifyTitle('  The   Santri!  '), 'the-santri');
});

test('categories are controlled — unknown values fall back to JOURNEY', () => {
  assert.equal(normalizeImpactCategory('people'), 'PEOPLE');
  assert.equal(normalizeImpactCategory('bogus'), 'JOURNEY');
  assert.deepEqual(IMPACT_CATEGORIES, ['PEOPLE', 'COMMUNITY', 'PHILOSOPHY', 'JOURNEY']);
});

test('reading time derives from text only and hides for light content', () => {
  assert.equal(computeImpactReadingMinutes([{ text: 'short note' }]), null);
  const longText = Array.from({ length: 60 }, (_, index) => `word${index}`).join(' ');
  assert.ok(computeImpactReadingMinutes([{ text: longText }]) >= 1);
});

test('block validation: text requires content, image requires url + alt', () => {
  assert.equal(validateImpactBlock({ type: 'TEXT', text: 'hello' }).ok, true);
  assert.equal(validateImpactBlock({ type: 'TEXT', text: '  ' }).ok, false);
  assert.equal(validateImpactBlock({ type: 'IMAGE', imageUrl: 'u', altText: 'a' }).ok, true);
  assert.equal(validateImpactBlock({ type: 'IMAGE', imageUrl: 'u', altText: '' }).ok, false);
  assert.equal(validateImpactBlock({ type: 'VIDEO' }).ok, false);
});

// ── Schema / migration guarantees ──────────────────────────────────────────

test('schema defines the four statuses and two block types only', () => {
  assert.match(schemaSource, /enum ImpactStoryStatus \{\s*DRAFT\s*COMING_SOON\s*NOW_LIVE\s*CLOSED/);
  assert.match(schemaSource, /enum ImpactBlockType \{\s*TEXT\s*IMAGE/);
});

test('slug is unique at database level', () => {
  assert.match(schemaSource, /slug\s+String\s+@unique/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX "ImpactStory_slug_key"/);
});

test('only ONE featured story enforced by partial unique index', () => {
  assert.match(migrationSource, /CREATE UNIQUE INDEX "ImpactStory_featured_single_idx" ON "ImpactStory"\("featured"\) WHERE "featured" = true/);
});

test('content blocks keep display order', () => {
  const blockModel = schemaSource.split('model ImpactContentBlock')[1].split('}')[0];
  assert.match(blockModel, /displayOrder\s+Int\s+@default\(0\)/);
  assert.match(migrationSource, /CREATE INDEX "ImpactContentBlock_displayOrder_idx"/);
});

// ── Service behavior ───────────────────────────────────────────────────────

test('service seeds the approved Impact direction as defaults', () => {
  assert.match(serviceSource, /THE WORK BEHIND THE MOVEMENT\./);
  assert.match(serviceSource, /Stories, progress, people, and ideas shaping what we are building together\./);
  assert.match(serviceSource, /100 Athletes\. One Purpose\./);
  assert.match(serviceSource, /Running Before Sunrise/);
  assert.match(serviceSource, /Calm Power/);
});

test('service excludes DRAFT from public listing and orders by status', () => {
  assert.match(serviceSource, /status: \{ not: IMPACT_STATUS\.DRAFT \}/);
  assert.match(serviceSource, /sortImpactStoriesForPublic/);
});

test('service rejects DRAFT on public detail (404 path)', () => {
  assert.match(serviceSource, /story\.status === IMPACT_STATUS\.DRAFT/);
  assert.match(serviceSource, /IMPACT_NOT_FOUND/);
});

test('featured swap unsets the previous featured first', () => {
  assert.match(serviceSource, /updateMany\(\{\s*where: \{ featured: true \}/);
  assert.match(serviceSource, /data: \{ featured: false \}/);
});

test('status change to public states sets publishedAt once', () => {
  assert.match(serviceSource, /becomesPublic && !story\.publishedAt/);
});

// ── Routes ─────────────────────────────────────────────────────────────────

test('public list performs server-side filtering/ordering and pagination params', () => {
  assert.match(publicListSource, /getPublicImpactList/);
  assert.match(publicListSource, /category/);
  assert.match(publicListSource, /offset/);
  assert.match(publicListSource, /limit/);
});

test('public detail route is slug-based and never exposes draft', () => {
  assert.match(publicDetailSource, /params\?\.slug/);
  assert.match(publicDetailSource, /getPublicImpactStory/);
});

test('admin route guards with HQ settings permissions', () => {
  assert.match(adminRouteSource, /requireHqPermission\(request, 'settings', 'view'\)/);
  assert.match(adminRouteSource, /requireHqPermission\(request, 'settings', 'manage_configuration'\)/);
  assert.match(adminRouteSource, /setFeatured/);
  assert.match(adminRouteSource, /setStatus/);
});

test('upload endpoint reuses the shared ImageKit helper with impact folder', () => {
  assert.match(uploadRouteSource, /uploadMovementImage/);
  assert.match(uploadRouteSource, /MOVEMENT_IMPACT_UPLOAD_FOLDER/);
  assert.doesNotMatch(uploadRouteSource, /IMAGEKIT_PRIVATE_KEY/);
});

test('dashboard registers the Impact CMS nav item and module', () => {
  assert.match(pageJsSource, /\{ id: "impactcms", label: "Impact", icon: BookOpen \}/);
  assert.match(pageJsSource, /impactcms: \(\) => <ImpactCmsModule user=\{user\} \/>/);
});
