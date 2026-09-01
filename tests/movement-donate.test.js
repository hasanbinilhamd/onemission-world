import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DONATION_CAMPAIGN_STATUS,
  DONATION_TRANSACTION_STATUS,
  DONATION_COUNTED_STATUSES,
  DONATION_TRANSACTION_NUMBER_PREFIX,
  DONATION_MIN_AMOUNT,
  validateDonationAmount,
  computeCampaignTotals,
  computeCampaignProgress,
  sortDonationsForPublic,
  resolvePublicDonor,
} from '../lib/donate/rules.js';

/**
 * Movement Donate — focused coverage.
 *  - pure business rules (amount validation, totals from PAID only, sorting,
 *    public name resolution)
 *  - schema/migration guarantees (slug unique, one ACTIVE via activeLock,
 *    transaction unique)
 *  - route wiring + webhook dispatch (source-level)
 */

const schemaSource = fs.readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migrationSource = fs.readFileSync(
  new URL('../prisma/migrations/20260901150000_add_donate_cms/migration.sql', import.meta.url),
  'utf8',
);
const serviceSource = fs.readFileSync(new URL('../lib/donate/service.js', import.meta.url), 'utf8');
const publicRouteSource = fs.readFileSync(new URL('../app/api/movement/donate/route.js', import.meta.url), 'utf8');
const donationsRouteSource = fs.readFileSync(new URL('../app/api/movement/donate/donations/route.js', import.meta.url), 'utf8');
const transactionsRouteSource = fs.readFileSync(new URL('../app/api/movement/donate/transactions/route.js', import.meta.url), 'utf8');
const campaignDetailSource = fs.readFileSync(new URL('../app/api/movement/donate/campaigns/[slug]/route.js', import.meta.url), 'utf8');
const adminRouteSource = fs.readFileSync(new URL('../app/api/admin/movement/donate/route.js', import.meta.url), 'utf8');
const uploadRouteSource = fs.readFileSync(new URL('../app/api/admin/movement/donate/upload/route.js', import.meta.url), 'utf8');
const notificationRouteSource = fs.readFileSync(new URL('../app/api/payments/midtrans/notification/route.js', import.meta.url), 'utf8');
const pageJsSource = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');

// ── Business rules ──────────────────────────────────────────────────────────

test('amount validation enforces minimum, maximum, and whole numbers', () => {
  assert.equal(validateDonationAmount(50_000).ok, true);
  assert.equal(validateDonationAmount(500).code, 'DONATION_AMOUNT_TOO_SMALL');
  assert.equal(validateDonationAmount(500_000_000).code, 'DONATION_AMOUNT_TOO_LARGE');
  assert.equal(validateDonationAmount(10_000.5).code, 'DONATION_AMOUNT_FRACTIONAL');
  assert.equal(validateDonationAmount('abc').code, 'DONATION_AMOUNT_INVALID');
  assert.equal(DONATION_MIN_AMOUNT, 1000);
});

test('campaign totals count ONLY successful donations', () => {
  const donations = [
    { amount: 100_000, status: 'PAID' },
    { amount: 50_000, status: 'PENDING' },
    { amount: 250_000, status: 'PAID' },
    { amount: 999_999, status: 'FAILED' },
    { amount: 1_000, status: 'EXPIRED' },
    { amount: 5_000, status: 'CANCELLED' },
  ];
  const totals = computeCampaignTotals(donations);
  assert.equal(totals.raised, 350_000);
  assert.equal(totals.donorCount, 2);
  assert.deepEqual([...DONATION_COUNTED_STATUSES], ['PAID']);
});

test('progress is capped at 100 and safe on zero target', () => {
  assert.equal(computeCampaignProgress(18_500_000, 25_000_000), 74);
  assert.equal(computeCampaignProgress(40_000_000, 25_000_000), 100);
  assert.equal(computeCampaignProgress(0, 0), 0);
});

test('donation sorting: LATEST newest-first, LARGEST amount-first (PAID only)', () => {
  const donations = [
    { amount: 50_000, status: 'PAID', createdAt: '2026-09-01' },
    { amount: 500_000, status: 'PENDING', createdAt: '2026-09-02' },
    { amount: 100_000, status: 'PAID', createdAt: '2026-08-30' },
  ];

  const latest = sortDonationsForPublic(donations, 'LATEST');
  assert.deepEqual(latest.map((item) => item.amount), [50_000, 100_000]);

  const largest = sortDonationsForPublic(donations, 'LARGEST');
  assert.deepEqual(largest.map((item) => item.amount), [100_000, 50_000]);
});

test('public donor names resolve to Anonymous when anonymous or nameless', () => {
  assert.equal(resolvePublicDonor({ anonymous: true, donorName: 'Fachri' }), 'Anonymous');
  assert.equal(resolvePublicDonor({ anonymous: false, donorName: 'Fachri' }), 'Fachri');
  assert.equal(resolvePublicDonor({ anonymous: false, donorName: '' }), 'Anonymous');
});

test('transaction numbers use the DON- prefix', () => {
  assert.equal(DONATION_TRANSACTION_NUMBER_PREFIX, 'DON-');
});

// ── Schema / migration guarantees ──────────────────────────────────────────

test('schema enforces slug uniqueness and single ACTIVE via activeLock', () => {
  const campaignModel = schemaSource.split('model DonationCampaign')[1].split('model DonationCampaignUpdate')[0];
  assert.match(campaignModel, /slug\s+String\s+@unique/);
  assert.match(campaignModel, /activeLock\s+String\?\s+@unique/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX "DonationCampaign_slug_key"/);
  assert.match(migrationSource, /CREATE UNIQUE INDEX "DonationCampaign_activeLock_key"/);
});

test('donation transactions are unique by transactionNumber', () => {
  assert.match(migrationSource, /CREATE UNIQUE INDEX "DonationTransaction_transactionNumber_key"/);
});

test('campaign statuses and transaction statuses are enumerated', () => {
  assert.match(schemaSource, /enum DonationCampaignStatus \{\s*DRAFT\s*ACTIVE\s*CLOSED/);
  assert.match(schemaSource, /enum DonationTransactionStatus \{\s*PENDING\s*PAID\s*FAILED\s*EXPIRED\s*CANCELLED/);
});

// ── Service behavior ───────────────────────────────────────────────────────

test('service seeds the approved campaign content ACTIVE', () => {
  assert.match(serviceSource, /SUPPORT FLOOD VICTIMS IN KALIMANTAN/);
  assert.match(serviceSource, /status: DONATION_CAMPAIGN_STATUS\.ACTIVE/);
  assert.match(serviceSource, /activeLock: 'active'/);
});

test('service enforces the one-ACTIVE rule with a clear message', () => {
  assert.match(serviceSource, /DONATION_CAMPAIGN_ALREADY_ACTIVE/);
  assert.match(serviceSource, /Another donation campaign is currently active/);
});

test('service reuses the shared Midtrans Snap provider', () => {
  assert.match(serviceSource, /MidtransProvider/);
  assert.match(serviceSource, /midtransProvider\.createPaymentSession/);
  assert.doesNotMatch(serviceSource, /MIDTRANS_SERVER_KEY/);
});

test('service computes totals from PAID donations — never stored counters', () => {
  assert.match(serviceSource, /computeCampaignTotals/);
  assert.doesNotMatch(serviceSource, /raisedAmount\s*[:=].*update/);
});

test('webhook notification handler is idempotent', () => {
  assert.match(serviceSource, /transaction\.status === nextStatus/);
  assert.match(serviceSource, /reused: true/);
});

// ── Routes ─────────────────────────────────────────────────────────────────

test('public create-donation endpoint never trusts client identity/status', () => {
  assert.doesNotMatch(transactionsRouteSource, /payload\.campaignId/);
  assert.doesNotMatch(transactionsRouteSource, /payload\.status/);
  assert.match(transactionsRouteSource, /payload\.amount/);
  assert.match(transactionsRouteSource, /payload\.donorName/);
  assert.match(transactionsRouteSource, /payload\.anonymous/);
  // No auth requirement anywhere in the donation flow.
  assert.doesNotMatch(transactionsRouteSource, /authenticateCustomerRequest|requireAuth/);
});

test('public payload exposes only display-safe fields', () => {
  assert.match(serviceSource, /serializePublicDonation/);
  assert.match(serviceSource, /donorName: resolvePublicDonor/);
  // The public serializer never returns email/phone/payment references.
  const serializerBlock = serviceSource.split('function serializePublicDonation')[1].split('function serializeAdminDonation')[0];
  assert.doesNotMatch(serializerBlock, /donorEmail|donorPhone|midtransTransactionId|snapToken/);
});

test('shared Midtrans webhook dispatches DON- transactions to donations', () => {
  assert.match(notificationRouteSource, /DONATION_TRANSACTION_NUMBER_PREFIX/);
  assert.match(notificationRouteSource, /donationService\.handleMidtransNotification/);
  assert.match(notificationRouteSource, /paymentAttemptService\.handleMidtransNotification/);
});

test('public donations list supports sort + offset/limit', () => {
  assert.match(donationsRouteSource, /sort/);
  assert.match(donationsRouteSource, /offset/);
  assert.match(donationsRouteSource, /limit/);
});

test('campaign detail rejects DRAFT server-side', () => {
  assert.match(campaignDetailSource, /getPublicCampaignDetail/);
  assert.match(serviceSource, /campaign\.status === DONATION_CAMPAIGN_STATUS\.DRAFT/);
});

test('admin route guards with HQ settings permissions', () => {
  assert.match(adminRouteSource, /requireHqPermission\(request, 'settings', 'view'\)/);
  assert.match(adminRouteSource, /requireHqPermission\(request, 'settings', 'manage_configuration'\)/);
  assert.match(adminRouteSource, /setStatus/);
});

test('upload endpoint reuses the shared ImageKit helper with donate folder', () => {
  assert.match(uploadRouteSource, /uploadMovementImage/);
  assert.match(uploadRouteSource, /MOVEMENT_DONATE_UPLOAD_FOLDER/);
  assert.doesNotMatch(uploadRouteSource, /IMAGEKIT_PRIVATE_KEY/);
});

// ── HQ sidebar separation ──────────────────────────────────────────────────

test('HQ sidebar separates Admin Settings from Website/CMS', () => {
  // The Settings group no longer contains the CMS entries…
  const settingsGroupBlock = pageJsSource.split('id: "system"')[1].split('id: "websitegroup"')[0];
  assert.doesNotMatch(settingsGroupBlock, /"website"|"homecms"|"missioncms"|"impactcms"|"donatecms"/);
  // …and a dedicated Website/CMS group contains them.
  const websiteGroupBlock = pageJsSource.split('id: "websitegroup"')[1].split('];')[0];
  assert.match(websiteGroupBlock, /\{ id: "website", label: "Website"/);
  assert.match(websiteGroupBlock, /\{ id: "homecms", label: "Home"/);
  assert.match(websiteGroupBlock, /\{ id: "missioncms", label: "Mission"/);
  assert.match(websiteGroupBlock, /\{ id: "impactcms", label: "Impact"/);
  assert.match(websiteGroupBlock, /\{ id: "donatecms", label: "Donate"/);
  assert.match(websiteGroupBlock, /\{ id: "earlyaccess", label: "Early Access"/);
  // Admin settings still present in the Settings group.
  assert.match(settingsGroupBlock, /Chart of Accounts/);
  assert.match(settingsGroupBlock, /Roles & Permissions/);
  assert.match(settingsGroupBlock, /System Configuration/);
});

test('dashboard registers the Donate CMS module', () => {
  assert.match(pageJsSource, /donatecms: \(\) => <DonateCmsModule user=\{user\} \/>/);
});
