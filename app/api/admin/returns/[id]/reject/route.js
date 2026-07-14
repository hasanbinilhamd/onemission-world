import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission, writeAuditLog } from '@/lib/hq-security';
import { normalizeOrderError, orderService } from '@/lib/order';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

export async function POST(request, { params }) {
  return withDevTiming(request, async () => {
    const payload = await request.json().catch(() => ({}));
    let authContext;

    try {
      authContext = await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    try {
      const response = await orderService.rejectReturnRequest({
        returnRequestId: params.id,
        rejectReason: payload.rejectReason,
        updatedBy: authContext.user.email || authContext.user.name,
      });

      await writeAuditLog({
        user: authContext.user,
        module: 'SALES',
        action: 'RETURN_REJECTED',
        description: `Rejected return request ${params.id}.`,
        metadata: { returnRequestId: params.id },
      });

      return NextResponse.json(response);
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
