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
    let authContext;

    try {
      authContext = await requireHqPermission(request, 'sales', 'fulfillment');
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 403 });
    }

    try {
      const response = await orderService.retryRefundRequest({
        returnRequestId: params.id,
        updatedBy: authContext.user.email || authContext.user.name,
      });

      await writeAuditLog({
        user: authContext.user,
        module: 'SALES',
        action: response.returnRequest?.refundStatus === 'PROCESSING' ? 'REFUND_SENT_TO_MIDTRANS' : 'REFUND_FAILED',
        description: response.returnRequest?.refundStatus === 'PROCESSING'
          ? `Retried refund request ${params.id} and sent it to Midtrans.`
          : `Retried refund request ${params.id}, but it failed again.`,
        metadata: {
          returnRequestId: params.id,
          refundStatus: response.returnRequest?.refundStatus || '',
          refundReference: response.returnRequest?.refundReference || '',
          refundFailureReason: response.returnRequest?.refundFailureReason || '',
        },
      });

      return NextResponse.json(response);
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
