import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { launchSubscriberService, LaunchSubscriberError } from '@/lib/launch-subscribers/service';

function buildErrorResponse(error, fallbackCode) {
  const normalized = error instanceof LaunchSubscriberError
    ? error
    : new LaunchSubscriberError({
        message: 'Something went wrong. Please try again later.',
        statusCode: 500,
        code: fallbackCode,
      });
  return NextResponse.json({ error: normalized.message, code: normalized.code }, { status: normalized.statusCode || 500 });
}

export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const url = new URL(request.url);
      const response = await launchSubscriberService.list({
        page: url.searchParams.get('page') || 1,
        limit: url.searchParams.get('limit') || 20,
        search: url.searchParams.get('search') || '',
        status: url.searchParams.get('status') || 'all',
        source: url.searchParams.get('source') || 'all',
        sortBy: url.searchParams.get('sortBy') || 'createdAt',
        sortOrder: url.searchParams.get('sortOrder') || 'desc',
      });
      return NextResponse.json(response);
    } catch (error) {
      return buildErrorResponse(error, 'LAUNCH_SUBSCRIBER_ADMIN_LIST_FAILED');
    }
  });
}
