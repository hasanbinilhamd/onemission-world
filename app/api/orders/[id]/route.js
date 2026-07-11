import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { normalizeOrderError, orderService } from '@/lib/order';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message },
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
      const order = await orderService.getOrderById(params.id);
      return NextResponse.json(order);
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
