import crypto from 'node:crypto';
import 'server-only';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 — server-only upload helper for the Movement CMS.
 *
 * HQ browsers post files to authenticated Next.js route handlers. Only those
 * server routes import this module, so R2 credentials never reach the client.
 */

export const MOVEMENT_HOME_UPLOAD_FOLDER = 'onemission/movement/home/';
export const MOVEMENT_MISSION_UPLOAD_FOLDER = 'onemission/movement/mission/';
export const MOVEMENT_IMPACT_UPLOAD_FOLDER = 'onemission/movement/impact/';
export const MOVEMENT_DONATE_UPLOAD_FOLDER = 'onemission/movement/donate/';

export const R2_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const R2_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const R2_ENV = {
  endpoint: 'R2_ENDPOINT',
  accessKeyId: 'R2_ACCESS_KEY_ID',
  secretAccessKey: 'R2_SECRET_ACCESS_KEY',
  bucketName: 'R2_BUCKET_NAME',
  publicBaseUrl: 'R2_PUBLIC_BASE_URL',
};

export class MovementImageUploadError extends Error {
  constructor({ message, statusCode = 400, code = 'IMAGE_UPLOAD_ERROR' }) {
    super(message);
    this.name = 'MovementImageUploadError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getR2Config() {
  const config = {
    endpoint: String(process.env[R2_ENV.endpoint] || '').trim().replace(/\/$/, ''),
    accessKeyId: String(process.env[R2_ENV.accessKeyId] || '').trim(),
    secretAccessKey: String(process.env[R2_ENV.secretAccessKey] || '').trim(),
    bucketName: String(process.env[R2_ENV.bucketName] || '').trim(),
    publicBaseUrl: String(process.env[R2_ENV.publicBaseUrl] || '').trim().replace(/\/$/, ''),
  };

  if (Object.values(config).some((value) => !value)) {
    throw new MovementImageUploadError({
      message: 'R2 is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL.',
      statusCode: 503,
      code: 'R2_CONFIG_MISSING',
    });
  }

  return config;
}

export function isR2Configured() {
  try {
    getR2Config();
    return true;
  } catch {
    return false;
  }
}

function getR2Client(config) {
  return new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
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

function normalizeFolder(folder = MOVEMENT_HOME_UPLOAD_FOLDER) {
  const normalized = String(folder || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  return `${normalized || 'onemission/movement/home'}/`;
}

function resolveExtension(mimeType) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

/**
 * Upload one immutable, UUID-named Movement CMS image to Cloudflare R2.
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

  if (!R2_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new MovementImageUploadError({
      message: `Unsupported image type: ${mimeType || 'unknown'}. Allowed: JPG, PNG, WebP.`,
      statusCode: 400,
      code: 'IMAGE_UPLOAD_TYPE_NOT_ALLOWED',
    });
  }

  if (fileBuffer.length > R2_MAX_FILE_BYTES) {
    throw new MovementImageUploadError({
      message: 'Image is too large. Maximum size is 5 MB.',
      statusCode: 400,
      code: 'IMAGE_UPLOAD_TOO_LARGE',
    });
  }

  const config = getR2Config();
  const normalizedFolder = normalizeFolder(folder);
  const safeName = `${normalizeFieldName(field)}-${crypto.randomUUID()}${resolveExtension(mimeType)}`;
  const objectKey = `${normalizedFolder}${safeName}`;
  const r2 = getR2Client(config);

  try {
    await r2.send(new PutObjectCommand({
      Bucket: config.bucketName,
      Key: objectKey,
      Body: fileBuffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    return {
      fileId: objectKey,
      url: `${config.publicBaseUrl}/${objectKey}`,
      name: safeName,
      folder: normalizedFolder,
    };
  } catch (error) {
    console.warn('[R2] Movement image upload failed:', error?.message || error);
    throw new MovementImageUploadError({
      message: 'Image upload failed. Please try again.',
      statusCode: 502,
      code: 'R2_UPLOAD_FAILED',
    });
  } finally {
    r2.destroy();
  }
}
