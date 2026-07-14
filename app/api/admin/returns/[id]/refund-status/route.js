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

export async function PATCH(request, { params }) {
  return withDevTiming(request, async () => {
    const payload = await request.json().catch(() => ({}));
    let authContext;

    try {
      authContext = await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    try {
      const response = await orderService.updateReturnRefundStatus({
        returnRequestId: params.id,
        refundStatus: payload.refundStatus,
        updatedBy: authContext.user.email || authContext.user.name,
      });

      await writeAuditLog({
        user: authContext.user,
        module: 'SALES',
        action: 'RETURN_REFUND_STATUS_UPDATED',
        description: `Updated refund status for return request ${params.id} to ${payload.refundStatus || ''}.`,
        metadata: { returnRequestId: params.id, refundStatus: payload.refundStatus || '' },
      });

      return NextResponse.json(response);
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
