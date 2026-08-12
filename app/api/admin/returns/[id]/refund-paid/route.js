import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission, writeAuditLog } from '@/lib/hq-security';
import { normalizeOrderError, orderService } from '@/lib/order';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json({ error: normalized.message, code: normalized.code }, { status: normalized.statusCode || 500 });
}

export async function POST(request, { params }) {
  return withDevTiming(request, async () => {
    let authContext;
    try {
      authContext = await requireHqPermission(request, 'finance', 'cash_out');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }
    const payload = await request.json().catch(() => ({}));
    try {
      const response = await orderService.markManualRefundPaid({ returnRequestId: params.id, refundAmount: payload.refundAmount, refundMethod: payload.refundMethod, refundDate: payload.refundDate, refundReference: payload.refundReference, note: payload.note, updatedBy: authContext.user.email || authContext.user.name });
      await writeAuditLog({ user: authContext.user, module: 'FINANCE', action: 'RETURN_REFUND_PAID', description: `Manual refund paid for return request ${params.id}.`, metadata: { returnRequestId: params.id, refundAmount: payload.refundAmount || 0 } });
      return NextResponse.json(response);
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
