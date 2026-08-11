import { NextResponse } from 'next/server';

const DEFAULT_CORS_ORIGINS = [
  'https://onemissionclo.com',
  'https://www.onemissionclo.com',
  'https://onemission-launch.vercel.app',
  'https://onemission-ecommerce.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
];

function normalizeOrigin(value = '') {
  return String(value || '').trim().replace(/\/$/, '');
}

function getAllowedOrigins() {
  const configured = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_CORS_ORIGINS;
}

function wildcardOriginToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^.]+');
  return new RegExp(`^${escaped}$`, 'i');
}

function resolveAllowedOrigin(requestOrigin) {
  const origin = normalizeOrigin(requestOrigin);
  if (!origin) return '';

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes('*')) return '*';

  return allowedOrigins.some((allowedOrigin) => {
    const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin);
    if (!normalizedAllowedOrigin) return false;
    if (normalizedAllowedOrigin.includes('*')) {
      return wildcardOriginToRegex(normalizedAllowedOrigin).test(origin);
    }
    return normalizedAllowedOrigin === origin;
  }) ? origin : '';
}

function applyCorsHeaders(response, request) {
  const requestOrigin = request.headers.get('origin') || '';
  const allowedOrigin = resolveAllowedOrigin(requestOrigin);

  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Vary', 'Origin');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    request.headers.get('access-control-request-headers') || 'Content-Type, Authorization, X-Requested-With',
  );
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

export function middleware(request) {
  if (request.method === 'OPTIONS') {
    return applyCorsHeaders(new NextResponse(null, { status: 204 }), request);
  }

  return applyCorsHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: ['/api/:path*'],
};
