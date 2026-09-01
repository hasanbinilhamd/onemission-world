import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  uploadMovementImage,
  isImageKitConfigured,
  IMAGEKIT_ALLOWED_MIME_TYPES,
  IMAGEKIT_MAX_FILE_BYTES,
} from '../lib/imagekit.js';

/**
 * Movement Home CMS — focused coverage:
 *  - ImageKit upload validation runs before any network call (no creds needed)
 *  - ImageKit private key never appears in client-facing/browser code
 *  - service defaults + destination allowlist + route wiring are present
 */

const serviceSource = fs.readFileSync(new URL('../lib/movement-home/service.js', import.meta.url), 'utf8');
const imagekitSource = fs.readFileSync(new URL('../lib/imagekit.js', import.meta.url), 'utf8');
const adminRouteSource = fs.readFileSync(new URL('../app/api/admin/movement/home/route.js', import.meta.url), 'utf8');
const uploadRouteSource = fs.readFileSync(new URL('../app/api/admin/movement/home/upload/route.js', import.meta.url), 'utf8');
const publicRouteSource = fs.readFileSync(new URL('../app/api/movement/home/route.js', import.meta.url), 'utf8');
const pageJsSource = fs.readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
const envExampleSource = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

test('ImageKit upload rejects empty files without touching the network', async () => {
  await assert.rejects(
    () => uploadMovementImage({ fileBuffer: Buffer.alloc(0), mimeType: 'image/png', field: 'hero-desktop' }),
    (error) => error?.code === 'IMAGE_UPLOAD_FILE_MISSING',
  );
});

test('ImageKit upload rejects unsupported MIME types', async () => {
  await assert.rejects(
    () => uploadMovementImage({ fileBuffer: Buffer.from('x'), mimeType: 'text/html', field: 'hero-desktop' }),
    (error) => error?.code === 'IMAGE_UPLOAD_TYPE_NOT_ALLOWED',
  );
});

test('ImageKit upload rejects oversized files before any network call', async () => {
  const oversized = Buffer.alloc(IMAGEKIT_MAX_FILE_BYTES + 1, 0);
  await assert.rejects(
    () => uploadMovementImage({ fileBuffer: oversized, mimeType: 'image/png', field: 'hero-desktop' }),
    (error) => error?.code === 'IMAGE_UPLOAD_TOO_LARGE',
  );
});

test('allowed MIME set covers the web image formats', () => {
  assert.deepEqual([...IMAGEKIT_ALLOWED_MIME_TYPES].sort(), ['image/jpeg', 'image/png', 'image/webp']);
});

test('ImageKit is not configured without ENV credentials', () => {
  assert.equal(isImageKitConfigured(), false);
});

test('movement Home destinations are the controlled allowlist', () => {
  // Service module is read as source: importing it pulls lib/cache →
  // server-only, which is guarded for the Next server bundler only.
  assert.match(serviceSource, /HOME_DESTINATIONS = \['mission', 'impact', 'shop', 'donate'\]/);
  assert.match(serviceSource, /HOME_DESTINATION_DEFAULT = 'mission'/);
});

test('service seeds the approved Home content as defaults', () => {
  assert.match(serviceSource, /We Build\. We Move\. We Serve\./);
  assert.match(serviceSource, /Join The Mission/);
  assert.match(serviceSource, /12K\+/);
  assert.match(serviceSource, /Muslims are moving together/);
  assert.match(serviceSource, /Vote Now/);
  assert.match(serviceSource, /Real Impact/);
  assert.match(serviceSource, /Performance/);
  assert.match(serviceSource, /Donate Now/);
  // Cards are always ordered by displayOrder — numbering is derived, not stored.
  assert.match(serviceSource, /displayOrder: 'asc'/);
  assert.doesNotMatch(serviceSource, /cardNumber|"number"\s*:/);
});

test('public flow no longer auto-seeds default content', () => {
  // The ensure* function may still exist as an explicit developer operation,
  // but the public/admin request flow must never call it automatically.
  assert.doesNotMatch(serviceSource, /await ensureMovementHomeDefaults\(\)/);
  // An empty database returns an empty structure, not DEFAULT_* content.
  assert.match(serviceSource, /home: homePage \? toPublicHomePage\(homePage\) : null/);
});
test('admin routes use HQ permission guards', () => {
  assert.match(adminRouteSource, /requireHqPermission\(request, 'settings', 'view'\)/);
  assert.match(adminRouteSource, /requireHqPermission\(request, 'settings', 'manage_configuration'\)/);
  assert.match(uploadRouteSource, /requireHqPermission\(request, 'settings', 'manage_configuration'\)/);
});

test('upload endpoint reads multipart file and delegates to server-side ImageKit', () => {
  assert.match(uploadRouteSource, /request\.formData\(\)/);
  assert.match(uploadRouteSource, /uploadMovementImage/);
  assert.match(uploadRouteSource, /fileId/);
});

test('public route serves movement Home content', () => {
  assert.match(publicRouteSource, /getPublicHomeContent/);
  assert.match(publicRouteSource, /force-dynamic/);
});

test('ImageKit private key stays server-only', () => {
  // Never reference the private key in any client component or public route.
  assert.doesNotMatch(publicRouteSource, /IMAGEKIT_PRIVATE_KEY/);
  assert.doesNotMatch(pageJsSource, /IMAGEKIT_PRIVATE_KEY/);
  // The helper intentionally returns only public-safe fields.
  assert.match(uploadRouteSource, /fileId|url/);
});

test('dashboard registers the Home CMS nav item and module', () => {
  assert.match(pageJsSource, /\{ id: "homecms", label: "Home", icon: Home \}/);
  assert.match(pageJsSource, /homecms: \(\) => <HomeCmsModule user=\{user\} \/>/);
});

test('ENV documentation includes ImageKit placeholders only', () => {
  assert.match(envExampleSource, /IMAGEKIT_PRIVATE_KEY=""/);
  assert.match(envExampleSource, /IMAGEKIT_PUBLIC_KEY=""/);
  assert.match(envExampleSource, /IMAGEKIT_URL_ENDPOINT=""/);
});
