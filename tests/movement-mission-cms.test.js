import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MAX_ACTIVE_MISSION_OPTIONS,
  countActiveOptions,
  validateOpenableMission,
  computeMissionResults,
} from '../lib/mission/rules.js';

/**
 * Movement Mission CMS — focused coverage.
 *  - Pure business rules (unit-tested directly, no DB needed)
 *  - Schema/migration guarantees (openLock unique, vote unique, no editable
 *    percentage/vote-count fields)
 *  - Route wiring + auth behavior (source-level)
 */

const schemaSource = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migrationSource = fs.readFileSync(
  new URL('../prisma/migrations/20260831140000_add_movement_mission_cms/migration.sql', import.meta.url),
  'utf8',
);
const serviceSource = fs.readFileSync(new URL('../lib/mission/service.js', import.meta.url), 'utf8');
const voteRouteSource = fs.readFileSync(new URL('../app/api/movement/mission/vote/route.js', import.meta.url), 'utf8');
const adminRouteSource = fs.readFileSync(new URL('../app/api/admin/movement/mission/route.js', import.meta.url), 'utf8');
const pageJsSource = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');

// ── Business rules ──────────────────────────────────────────────────────────

test('maximum active options is exactly 4', () => {
  assert.equal(MAX_ACTIVE_MISSION_OPTIONS, 4);
});

test('countActiveOptions counts only active options', () => {
  assert.equal(countActiveOptions([
    { isActive: true },
    { isActive: false },
    { isActive: true },
    {},
  ]), 3);
});

test('a mission with 4 active options is openable', () => {
  const result = validateOpenableMission({ activeOptionCount: 4 });
  assert.equal(result.ok, true);
});

test('a mission with 5 active options is rejected', () => {
  const result = validateOpenableMission({ activeOptionCount: 5 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MISSION_OPEN_ACTIVE_OPTIONS_EXCEEDED');
});

test('a mission with 0 active options is rejected', () => {
  const result = validateOpenableMission({ activeOptionCount: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MISSION_OPEN_ACTIVE_OPTIONS_REQUIRED');
});

test('results are computed from real vote counts — never stored', () => {
  const { totalVotes, results } = computeMissionResults({
    countsByOptionId: { a: 48, b: 31, c: 13, d: 8 },
    activeOptionIds: ['a', 'b', 'c', 'd'],
  });
  assert.equal(totalVotes, 100);
  assert.deepEqual(results.map((row) => row.percentage), [48, 31, 13, 8]);
});

test('results with zero votes produce zero totals (no fabrication)', () => {
  const { totalVotes, results } = computeMissionResults({
    countsByOptionId: {},
    activeOptionIds: ['a', 'b'],
  });
  assert.equal(totalVotes, 0);
  assert.deepEqual(results.map((row) => row.percentage), [0, 0]);
});

// ── Schema / migration guarantees ──────────────────────────────────────────

test('one-OPEN rule is enforced at database level via openLock unique column', () => {
  assert.match(schemaSource, /openLock\s+String\?\s+@unique/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX "Mission_openLock_key"/);
});

test('one vote per customer per mission is a database unique constraint', () => {
  assert.match(schemaSource, /@@unique\(\[missionId, customerId\]\)/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX "MissionVote_missionId_customerId_key"/);
});

test('no editable vote-count/percentage fields exist on mission models', () => {
  const modelBlock = schemaSource.split('model MissionVote')[0];
  const missionModels = modelBlock.slice(modelBlock.lastIndexOf('model Mission'));
  assert.doesNotMatch(missionModels, /voteCount\s+\w+/);
  assert.doesNotMatch(missionModels, /percentage\s+\w+/);
  assert.doesNotMatch(missionModels, /totalVoters\s+\w+/);
});

test('mission status enum supports DRAFT / OPEN / CLOSED', () => {
  assert.match(schemaSource, /enum MissionStatus \{\s*DRAFT\s*OPEN\s*CLOSED/);
});

// ── Service behavior (source-level) ────────────────────────────────────────

test('service computes results from real vote records via groupBy', () => {
  assert.match(serviceSource, /missionVote\.groupBy/);
  assert.match(serviceSource, /computeMissionResults/);
});

test('service enforces the active-options limit before opening', () => {
  assert.match(serviceSource, /validateOpenableMission/);
  assert.match(serviceSource, /MAX_ACTIVE_MISSION_OPTIONS/);
});

test('service rejects opening a second mission with a clear message', () => {
  assert.match(serviceSource, /MISSION_ALREADY_OPEN/);
  assert.match(serviceSource, /Another voting mission is currently open/);
});

test('service preserves closed missions and votes (no delete on close)', () => {
  assert.doesNotMatch(serviceSource, /missionVote\.deleteMany/);
});

test('defaults match the approved Mission page content', () => {
  assert.match(serviceSource, /YOUR VOICE, OUR NEXT STEP/);
  assert.match(serviceSource, /THE NEXT MISSION IS YOURS\./);
  assert.match(serviceSource, /Your vote will shape our next move as a movement\./);
  assert.match(serviceSource, /PESANTREN/);
  assert.match(serviceSource, /MUSLIM FOOTBALL/);
  assert.match(serviceSource, /MUSLIM CALISTHENICS/);
  assert.match(serviceSource, /YOUTH DEVELOPMENT/);
});

// ── Routes ─────────────────────────────────────────────────────────────────

test('vote endpoint resolves identity server-side and never trusts client mission ids', () => {
  assert.match(voteRouteSource, /authenticateCustomerRequest\(request, \{ optional: true \}\)/);
  assert.match(voteRouteSource, /ANONYMOUS_VOTER_COOKIE_NAME/);
  assert.match(voteRouteSource, /crypto\.randomUUID/);
  assert.match(voteRouteSource, /httpOnly: true/);
  assert.doesNotMatch(voteRouteSource, /payload\.missionId/);
  // Authentication is optional — the auth-required error must no longer exist.
  assert.doesNotMatch(voteRouteSource, /MISSION_VOTE_AUTH_REQUIRED/);
  assert.match(voteRouteSource, /payload\.missionOptionId/);
});

test('admin route guards with HQ settings permissions', () => {
  assert.match(adminRouteSource, /requireHqPermission\(request, 'settings', 'view'\)/);
  assert.match(adminRouteSource, /requireHqPermission\(request, 'settings', 'manage_configuration'\)/);
});

test('dashboard registers the Mission CMS nav item and module', () => {
  assert.match(pageJsSource, /\{ id: "missioncms", label: "Mission", icon: Target \}/);
  assert.match(pageJsSource, /missioncms: \(\) => <MissionCmsModule user=\{user\} \/>/);
});

test('mission upload endpoint reuses the shared ImageKit helper with mission folder', () => {
  const uploadRouteSource = fs.readFileSync(
    new URL('../app/api/admin/movement/mission/upload/route.js', import.meta.url),
    'utf8',
  );
  assert.match(uploadRouteSource, /uploadMovementImage/);
  assert.match(uploadRouteSource, /MOVEMENT_MISSION_UPLOAD_FOLDER/);
  assert.doesNotMatch(uploadRouteSource, /IMAGEKIT_PRIVATE_KEY/);
});
