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

export async function GET(request, { params }) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'sales', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    try {
      const session = await checkoutService.getCheckoutSessionAdminById(params.id);
      return NextResponse.json(session);
    } catch (error) {
      return buildCheckoutErrorResponse(error);
    }
  });
}
