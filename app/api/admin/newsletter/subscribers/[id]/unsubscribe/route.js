import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { newsletterService, NewsletterError } from '@/lib/newsletter/service';

export async function POST(request, { params }) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'update');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    try {
      const response = await newsletterService.unsubscribeSubscriber({
        subscriberId: params.id,
      });
      return NextResponse.json({
        success: true,
        message: 'Subscriber marked as unsubscribed.',
        subscriber: response,
      });
    } catch (error) {
      const normalizedError = error instanceof NewsletterError
        ? error
        : new NewsletterError({
            message: 'Something went wrong. Please try again later.',
            statusCode: 500,
            code: 'NEWSLETTER_ADMIN_UNSUBSCRIBE_FAILED',
          });
      return NextResponse.json({ error: normalizedError.message, code: normalizedError.code }, { status: normalizedError.statusCode || 500 });
    }
  });
}
