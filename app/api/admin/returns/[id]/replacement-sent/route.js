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
      authContext = await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }
    const payload = await request.json().catch(() => ({}));
    try {
      const response = await orderService.markReplacementSent({ returnRequestId: params.id, replacementItems: payload.replacementItems || [], note: payload.note || '', updatedBy: authContext.user.email || authContext.user.name });
      await writeAuditLog({ user: authContext.user, module: 'SALES', action: 'REPLACEMENT_SENT', description: `Replacement sent for return request ${params.id}.`, metadata: { returnRequestId: params.id } });
      return NextResponse.json(response);
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
