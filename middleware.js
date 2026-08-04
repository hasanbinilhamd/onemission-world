import { NextResponse } from 'next/server';

const CORS_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const CORS_HEADERS = 'Accept, Authorization, Content-Type, X-Requested-With';
const DEFAULT_ALLOWED_ORIGINS = '*';

function getAllowedOrigins() {
  return String(process.env.CORS_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function wildcardOriginMatches(pattern, origin) {
  if (!pattern.includes('*')) return false;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(origin);
}

function resolveAllowedOrigin(requestOrigin) {
  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.includes('*')) {
    return requestOrigin || '*';
  }

  if (!requestOrigin) {
    return '';
  }

  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  const matchesWildcard = allowedOrigins.some((allowedOrigin) => wildcardOriginMatches(allowedOrigin, requestOrigin));
  return matchesWildcard ? requestOrigin : '';
}

function buildCorsHeaders(request) {
  const requestOrigin = request.headers.get('origin') || '';
  const allowedOrigin = resolveAllowedOrigin(requestOrigin);
  const headers = new Headers();

  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Vary', 'Origin');
  }

  headers.set('Access-Control-Allow-Methods', CORS_METHODS);
  headers.set('Access-Control-Allow-Headers', request.headers.get('access-control-request-headers') || CORS_HEADERS);
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

function applyCorsHeaders(response, request) {
  const corsHeaders = buildCorsHeaders(request);
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}

export function middleware(request) {
  const isApiRequest = request.nextUrl.pathname.startsWith('/api/');

  if (!isApiRequest) {
    return NextResponse.next();
  }

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: buildCorsHeaders(request),
    });
  }

  return applyCorsHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: '/api/:path*',
};
