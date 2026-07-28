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
      const csv = await newsletterService.exportSubscribersCsv({
        search: url.searchParams.get('search') || '',
        status: url.searchParams.get('status') || 'all',
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      const normalizedError = error instanceof NewsletterError
        ? error
        : new NewsletterError({
            message: 'Something went wrong. Please try again later.',
            statusCode: 500,
            code: 'NEWSLETTER_ADMIN_EXPORT_FAILED',
          });
      return NextResponse.json({ error: normalizedError.message, code: normalizedError.code }, { status: normalizedError.statusCode || 500 });
    }
  });
}
