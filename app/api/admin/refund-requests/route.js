import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { normalizeOrderError, orderService } from '@/lib/order';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

export async function GET(request) {
  return withDevTiming(request, async () => {
    const url = new URL(request.url);

    try {
      await requireHqPermission(request, 'sales', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    try {
      const response = await orderService.listRefundRequests({
        page: url.searchParams.get('page') || 1,
        limit: url.searchParams.get('limit') || 10,
        search: url.searchParams.get('search') || '',
        refundStatus: url.searchParams.get('refundStatus') || 'all',
      });

      return NextResponse.json(response);
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
