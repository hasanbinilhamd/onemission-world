import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { launchSubscriberService, LaunchSubscriberError } from '@/lib/launch-subscribers/service';

export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const url = new URL(request.url);
      const workbookBuffer = await launchSubscriberService.exportXlsx({
        search: url.searchParams.get('search') || '',
        status: url.searchParams.get('status') || 'all',
        source: url.searchParams.get('source') || 'all',
        sortBy: url.searchParams.get('sortBy') || 'createdAt',
        sortOrder: url.searchParams.get('sortOrder') || 'desc',
      });

      return new NextResponse(workbookBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="launch-subscribers.xlsx"',
          'Cache-Control': 'no-store',
        },
      });
    } catch (error) {
      const normalized = error instanceof LaunchSubscriberError
        ? error
        : new LaunchSubscriberError({
            message: 'Something went wrong. Please try again later.',
            statusCode: 500,
            code: 'LAUNCH_SUBSCRIBER_ADMIN_EXPORT_FAILED',
          });
      return NextResponse.json({ error: normalized.message, code: normalized.code }, { status: normalized.statusCode || 500 });
    }
  });
}
