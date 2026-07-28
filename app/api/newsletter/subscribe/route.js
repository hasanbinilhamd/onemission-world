import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { newsletterService, NewsletterError, NEWSLETTER_SUBSCRIBER_SOURCE } from '@/lib/newsletter/service';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_STORE = globalThis.__onemissionNewsletterRateLimitStore ?? new Map();
globalThis.__onemissionNewsletterRateLimitStore = RATE_LIMIT_STORE;

function getRequestIpAddress(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }

  return request.headers.get('x-real-ip') || '';
}

function enforceRateLimit(ipAddress) {
  const key = String(ipAddress || 'unknown').trim() || 'unknown';
  const now = Date.now();
  const currentEntry = RATE_LIMIT_STORE.get(key);

  if (!currentEntry || now > currentEntry.expiresAt) {
    RATE_LIMIT_STORE.set(key, {
      count: 1,
      expiresAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return;
  }

  if (currentEntry.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new NewsletterError({
      message: 'Something went wrong. Please try again later.',
      statusCode: 429,
      code: 'NEWSLETTER_RATE_LIMITED',
    });
  }

  currentEntry.count += 1;
  RATE_LIMIT_STORE.set(key, currentEntry);
}

async function readRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function POST(request) {
  return withDevTiming(request, async () => {
    try {
      const ipAddress = getRequestIpAddress(request);
      enforceRateLimit(ipAddress);
      const payload = await readRequestBody(request);
      const result = await newsletterService.subscribe({
        email: payload.email,
        source: NEWSLETTER_SUBSCRIBER_SOURCE.FOOTER,
        ipAddress,
        userAgent: request.headers.get('user-agent') || '',
      });

      return NextResponse.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      const normalizedError = error instanceof NewsletterError
        ? error
        : new NewsletterError({
            message: 'Something went wrong. Please try again later.',
            statusCode: 500,
            code: 'NEWSLETTER_SUBSCRIBE_FAILED',
          });

      return NextResponse.json({
        success: false,
        message: normalizedError.message,
        code: normalizedError.code,
      }, {
        status: normalizedError.statusCode || 500,
      });
    }
  });
}
