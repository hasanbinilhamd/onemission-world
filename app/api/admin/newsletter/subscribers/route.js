import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { newsletterService, NewsletterError } from '@/lib/newsletter/service';

export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    try {
      const url = new URL(request.url);
      const response = await newsletterService.listSubscribers({
        page: url.searchParams.get('page') || 1,
        limit: url.searchParams.get('limit') || 20,
        search: url.searchParams.get('search') || '',
        status: url.searchParams.get('status') || 'all',
      });
      return NextResponse.json(response);
    } catch (error) {
      const normalizedError = error instanceof NewsletterError
        ? error
        : new NewsletterError({
            message: 'Something went wrong. Please try again later.',
            statusCode: 500,
            code: 'NEWSLETTER_ADMIN_LIST_FAILED',
          });
      return NextResponse.json({ error: normalizedError.message, code: normalizedError.code }, { status: normalizedError.statusCode || 500 });
    }
  });
}
