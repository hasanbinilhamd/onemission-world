import crypto from 'node:crypto';
import ImageKit from 'imagekit';

/**
 * ImageKit — server-only upload helper for the movement CMS.
 *
 * IMPORTANT: this module must only ever be imported from server route
 * handlers. The private key NEVER leaves the server: the HQ admin UI posts
 * the file to a server endpoint, the server uploads it to ImageKit, and only
 * the resulting public URL/fileId are stored/returned.
 *
 * Scope: movement CMS modules only (Home now; Mission/Impact/Donate later).
 * This is intentionally NOT a global media library.
 */

export const MOVEMENT_HOME_UPLOAD_FOLDER = '/onemission/movement/home';
export const MOVEMENT_MISSION_UPLOAD_FOLDER = '/onemission/movement/mission';

export const IMAGEKIT_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const IMAGEKIT_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const IMAGEKIT_ENV = {
  privateKey: 'IMAGEKIT_PRIVATE_KEY',
  publicKey: 'IMAGEKIT_PUBLIC_KEY',
  urlEndpoint: 'IMAGEKIT_URL_ENDPOINT',
};

export class MovementImageUploadError extends Error {
  constructor({ message, statusCode = 400, code = 'IMAGE_UPLOAD_ERROR' }) {
    super(message);
    this.name = 'MovementImageUploadError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function isImageKitConfigured() {
  const privateKey = String(process.env[IMAGEKIT_ENV.privateKey] || '').trim();
  const publicKey = String(process.env[IMAGEKIT_ENV.publicKey] || '').trim();
  const urlEndpoint = String(process.env[IMAGEKIT_ENV.urlEndpoint] || '').trim();
  return Boolean(privateKey && publicKey && urlEndpoint);
}

function getImageKitClient() {
  const privateKey = String(process.env[IMAGEKIT_ENV.privateKey] || '').trim();
  const publicKey = String(process.env[IMAGEKIT_ENV.publicKey] || '').trim();
  const urlEndpoint = String(process.env[IMAGEKIT_ENV.urlEndpoint] || '').trim();

  if (!privateKey || !publicKey || !urlEndpoint) {
    throw new MovementImageUploadError({
      message: 'ImageKit is not configured. Set IMAGEKIT_PRIVATE_KEY, IMAGEKIT_PUBLIC_KEY, and IMAGEKIT_URL_ENDPOINT.',
      statusCode: 503,
      code: 'IMAGEKIT_CONFIG_MISSING',
    });
  }

  return new ImageKit({
    privateKey,
    publicKey,
    urlEndpoint,
  });
}

function normalizeFieldName(field = '') {
  const slug = String(field || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || 'image';
}

function resolveExtension(mimeType) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

/**
 * Upload a single image buffer to ImageKit under the movement Home folder.
 *
 * @param {{ fileBuffer: Buffer, mimeType: string, field?: string, folder?: string }} options
 * @returns {Promise<{ fileId: string, url: string, name: string, folder: string }>}
 */
export async function uploadMovementImage({ fileBuffer, mimeType, field = '', folder = MOVEMENT_HOME_UPLOAD_FOLDER }) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new MovementImageUploadError({
      message: 'No file was provided.',
      statusCode: 400,
      code: 'IMAGE_UPLOAD_FILE_MISSING',
    });
  }

  if (!IMAGEKIT_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new MovementImageUploadError({
      message: `Unsupported image type: ${mimeType || 'unknown'}. Allowed: JPG, PNG, WebP.`,
      statusCode: 400,
      code: 'IMAGE_UPLOAD_TYPE_NOT_ALLOWED',
    });
  }

  if (fileBuffer.length > IMAGEKIT_MAX_FILE_BYTES) {
    throw new MovementImageUploadError({
      message: 'Image is too large. Maximum size is 5 MB.',
      statusCode: 400,
      code: 'IMAGE_UPLOAD_TOO_LARGE',
    });
  }

  const safeName = `${normalizeFieldName(field)}-${crypto.randomUUID()}${resolveExtension(mimeType)}`;
  const imagekit = getImageKitClient();

  try {
    const result = await imagekit.upload({
      file: fileBuffer,
      fileName: safeName,
      folder,
      useUniqueFileName: true,
    });

    return {
      fileId: String(result?.fileId || ''),
      url: String(result?.url || ''),
      name: String(result?.name || safeName),
      folder: String(result?.filePath || folder),
    };
  } catch (error) {
    // Do not leak the ImageKit response body (may contain credentials context).
    console.warn('[ImageKit] Movement image upload failed:', error?.message || error);
    throw new MovementImageUploadError({
      message: 'Image upload failed. Please try again.',
      statusCode: 502,
      code: 'IMAGEKIT_UPLOAD_FAILED',
    });
  }
}
