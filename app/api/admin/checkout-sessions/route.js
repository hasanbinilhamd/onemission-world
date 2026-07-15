import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { checkoutService, normalizeCheckoutError } from '@/lib/checkout';

function buildCheckoutErrorResponse(error) {
  const normalized = normalizeCheckoutError(error);
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
      const response = await checkoutService.listCheckoutSessionsForAdmin({
        page: url.searchParams.get('page') || 1,
        limit: url.searchParams.get('limit') || 20,
        search: url.searchParams.get('search') || '',
        status: url.searchParams.get('status') || 'all',
      });
      return NextResponse.json(response);
    } catch (error) {
      return buildCheckoutErrorResponse(error);
    }
  });
}
