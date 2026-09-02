import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PAGE_AVAILABILITY,
  PAGE_AVAILABILITY_PAGES,
} from '../lib/page-availability/service.js';

/**
 * Page Availability — focused coverage.
 *  - pure value/allowlist rules (imported directly, no DB)
 *  - schema/migration guarantees (default AVAILABLE, single row per page)
 *  - public payload wiring (mission/impact/donate expose pageAvailability)
 *  - admin route permissions + shared CMS controls
 */

const schemaSource = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migrationSource = fs.readFileSync(
  new URL('../prisma/migrations/20260902130000_add_page_availability/migration.sql', import.meta.url),
  'utf8',
);
const serviceSource = fs.readFileSync(new URL('../lib/page-availability/service.js', import.meta.url), 'utf8');
const adminRouteSource = fs.readFileSync(new URL('../app/api/admin/movement/page-availability/route.js', import.meta.url), 'utf8');
const missionServiceSource = fs.readFileSync(new URL('../lib/mission/service.js', import.meta.url), 'utf8');
const impactServiceSource = fs.readFileSync(new URL('../lib/impact/service.js', import.meta.url), 'utf8');
const donateServiceSource = fs.readFileSync(new URL('../lib/donate/service.js', import.meta.url), 'utf8');

test('page availability values are exactly AVAILABLE / COMING_SOON', () => {
  assert.deepEqual(PAGE_AVAILABILITY, { AVAILABLE: 'AVAILABLE', COMING_SOON: 'COMING_SOON' });
  assert.deepEqual(PAGE_AVAILABILITY_PAGES, ['mission', 'impact', 'donate']);
});

test('schema defaults to AVAILABLE (backward-compatible, no content touched)', () => {
  assert.match(schemaSource, /enum PageAvailability \{\s*AVAILABLE\s*COMING_SOON/);
  assert.match(schemaSource, /availability PageAvailability @default\(AVAILABLE\)/);
  assert.match(migrationSource, /DEFAULT 'AVAILABLE'/);
  // The migration only adds the availability config — it never touches
  // mission votes, impact records, or donation campaigns.
  assert.doesNotMatch(migrationSource, /MissionVote|ImpactStory|DonationCampaign|DELETE|UPDATE/);
});

test('service treats a missing row as AVAILABLE (safe default)', () => {
  assert.match(serviceSource, /setting\?\.availability \|\| PAGE_AVAILABILITY\.AVAILABLE/);
});

test('service rejects unknown pages and invalid values', () => {
  assert.match(serviceSource, /PAGE_AVAILABILITY_UNKNOWN_PAGE/);
  assert.match(serviceSource, /PAGE_AVAILABILITY_INVALID_VALUE/);
  assert.match(serviceSource, /PAGE_AVAILABILITY_PAGES\.includes/);
});

test('admin route guards with HQ settings permissions', () => {
  assert.match(adminRouteSource, /requireHqPermission\(request, 'settings', 'view'\)/);
  assert.match(adminRouteSource, /requireHqPermission\(request, 'settings', 'manage_configuration'\)/);
});

test('public payloads expose pageAvailability for mission, impact, donate', () => {
  assert.match(missionServiceSource, /pageAvailability: pageAvailability\.availability/);
  assert.match(impactServiceSource, /pageAvailability: pageAvailability\.availability/);
  assert.match(donateServiceSource, /pageAvailability: pageAvailability\.availability/);
});

test('availability is independent from content statuses (no coupling)', () => {
  // Mission/impact/donate services keep their content logic untouched;
  // availability is only added as a separate field.
  assert.doesNotMatch(serviceSource, /MISSION_STATUS|IMPACT_STATUS|DONATION_CAMPAIGN_STATUS/);
});
