import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ANONYMOUS_VOTER_COOKIE_NAME,
  ANONYMOUS_VOTER_COOKIE_MAX_AGE_SECONDS,
  resolveVoterIdentity,
} from '../lib/mission/rules.js';

/**
 * Anonymous Mission voting — focused coverage.
 *  - pure identity resolution rules (unit-tested directly)
 *  - schema/migration guarantees (nullable customerId, anonymousVoterId,
 *    preserved rows, both uniqueness constraints)
 *  - route/service behavior (source-level)
 */

const schemaSource = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migrationSource = fs.readFileSync(
  new URL('../prisma/migrations/20260831150000_add_anonymous_mission_voting/migration.sql', import.meta.url),
  'utf8',
);
const serviceSource = fs.readFileSync(new URL('../lib/mission/service.js', import.meta.url), 'utf8');
const voteRouteSource = fs.readFileSync(new URL('../app/api/movement/mission/vote/route.js', import.meta.url), 'utf8');
const publicRouteSource = fs.readFileSync(new URL('../app/api/movement/mission/route.js', import.meta.url), 'utf8');

// ── Identity rules ─────────────────────────────────────────────────────────

test('anonymous-only identity resolves to anonymousVoterId', () => {
  const result = resolveVoterIdentity({ customerId: null, anonymousVoterId: 'anon-1' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.identity, { customerId: null, anonymousVoterId: 'anon-1' });
});

test('authenticated identity takes precedence over anonymous', () => {
  const result = resolveVoterIdentity({ customerId: 'cust-1', anonymousVoterId: 'anon-1' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.identity, { customerId: 'cust-1', anonymousVoterId: null });
});

test('a vote without any identity is rejected', () => {
  const result = resolveVoterIdentity({});
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MISSION_VOTE_IDENTITY_REQUIRED');
});

test('anonymous voter cookie is long-lived, HttpOnly by convention', () => {
  assert.equal(ANONYMOUS_VOTER_COOKIE_NAME, 'om_voter_id');
  assert.ok(ANONYMOUS_VOTER_COOKIE_MAX_AGE_SECONDS >= 60 * 60 * 24 * 30);
});

// ── Schema / migration guarantees ─────────────────────────────────────────

test('customerId becomes nullable so anonymous votes can exist', () => {
  const modelBlock = schemaSource.split('model MissionVote')[1].split('}')[0];
  assert.match(modelBlock, /customerId\s+String\?/);
  assert.match(modelBlock, /anonymousVoterId\s+String\?/);
});

test('both voter identities are protected by uniqueness per mission', () => {
  const modelBlock = schemaSource.split('model MissionVote')[1].split('}')[0];
  assert.match(modelBlock, /@@unique\(\[missionId, customerId\]\)/);
  assert.match(modelBlock, /@@unique\(\[missionId, anonymousVoterId\]\)/);
});

test('migration preserves existing authenticated votes (no delete/reset)', () => {
  assert.match(migrationSource, /ALTER COLUMN "customerId" DROP NOT NULL/);
  assert.match(migrationSource, /ADD COLUMN "anonymousVoterId" TEXT/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX "MissionVote_missionId_anonymousVoterId_key"/);
  assert.doesNotMatch(migrationSource, /DELETE FROM|TRUNCATE|DROP TABLE/);
});

// ── Service behavior ──────────────────────────────────────────────────────

test('service rejects duplicate votes with MISSION_ALREADY_VOTED (no auth requirement)', () => {
  assert.match(serviceSource, /MISSION_ALREADY_VOTED/);
  assert.match(serviceSource, /You have already voted for this mission\./);
  assert.doesNotMatch(serviceSource, /MISSION_VOTE_AUTH_REQUIRED/);
});

test('service stores anonymousVoterId and customerId on the same vote model', () => {
  assert.match(serviceSource, /anonymousVoterId: identity\.identity\.anonymousVoterId/);
  assert.match(serviceSource, /customerId: identity\.identity\.customerId/);
});

test('service computes hasVoted for anonymous and authenticated identities', () => {
  assert.match(serviceSource, /resolveVoterIdentity\(\{ customerId, anonymousVoterId \}\)/);
  assert.match(serviceSource, /anonymousVoterId: identity\.identity\.anonymousVoterId/);
});

// ── Routes ────────────────────────────────────────────────────────────────

test('vote route generates a secure HttpOnly anonymous cookie server-side', () => {
  assert.match(voteRouteSource, /crypto\.randomUUID\(\)/);
  assert.match(voteRouteSource, /request\.cookies\.get\(ANONYMOUS_VOTER_COOKIE_NAME\)/);
  assert.match(voteRouteSource, /httpOnly: true/);
  assert.match(voteRouteSource, /secure: process\.env\.NODE_ENV === 'production'/);
  assert.match(voteRouteSource, /sameSite: 'lax'/);
  assert.match(voteRouteSource, /maxAge: ANONYMOUS_VOTER_COOKIE_MAX_AGE_SECONDS/);
  assert.match(voteRouteSource, /nextResponse\.cookies\.set/);
});

test('vote route never trusts client-provided identity fields', () => {
  assert.doesNotMatch(voteRouteSource, /payload\.customerId/);
  assert.doesNotMatch(voteRouteSource, /payload\.anonymousVoterId/);
  assert.doesNotMatch(voteRouteSource, /payload\.missionId/);
});

test('vote route adds minimal rate limiting reusing the existing limiter', () => {
  assert.match(voteRouteSource, /createMemoryRateLimiter/);
  assert.match(voteRouteSource, /MISSION_VOTE_RATE_LIMITED/);
});

test('public mission route reads the anonymous cookie for the hasVoted state', () => {
  assert.match(publicRouteSource, /ANONYMOUS_VOTER_COOKIE_NAME/);
  assert.match(publicRouteSource, /getPublicMissionContent/);
});
