import { NextResponse } from 'next/server';
import { launchSubscriberService, LaunchSubscriberError } from '@/lib/launch-subscribers/service';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const globalLaunchSubscribeRateLimit = globalThis.__onemissionLaunchSubscribeRateLimit ?? new Map();
globalThis.__onemissionLaunchSubscribeRateLimit = globalLaunchSubscribeRateLimit;

function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  return forwardedFor.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function isRateLimited(request) {
  const ipAddress = getClientIp(request);
  const now = Date.now();
  const entry = globalLaunchSubscribeRateLimit.get(ipAddress) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (entry.resetAt <= now) {
    globalLaunchSubscribeRateLimit.set(ipAddress, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  globalLaunchSubscribeRateLimit.set(ipAddress, entry);
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

async function readRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function buildErrorResponse(error) {
  const normalized = error instanceof LaunchSubscriberError
    ? error
    : new LaunchSubscriberError({
        message: 'Masukkan nomor WhatsApp yang valid.',
        statusCode: 400,
        code: 'LAUNCH_SUBSCRIBER_INVALID_REQUEST',
      });

  return NextResponse.json(
    { success: false, message: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 400 },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request) {
  if (isRateLimited(request)) {
    return NextResponse.json(
      { success: false, message: 'Too many requests. Please try again shortly.', code: 'LAUNCH_SUBSCRIBER_RATE_LIMITED' },
      { status: 429 },
    );
  }

  try {
    const payload = await readRequestBody(request);
    const response = await launchSubscriberService.subscribe({
      phone: payload.phone,
      source: 'launch-page',
    });
    return NextResponse.json({
      success: true,
      duplicate: Boolean(response.duplicate),
      message: response.message,
    });
  } catch (error) {
    return buildErrorResponse(error);
  }
}
