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
      const response = await orderService.approveReturnRequest({
        returnRequestId: params.id,
        updatedBy: authContext.user.email || authContext.user.name,
      });

      await writeAuditLog({
        user: authContext.user,
        module: 'SALES',
        action: 'RETURN_APPROVED',
        description: `Approved return request ${params.id}.`,
        metadata: { returnRequestId: params.id },
      });

      if (response?.returnRequest?.refundStatus === 'PROCESSING') {
        await writeAuditLog({
          user: authContext.user,
          module: 'SALES',
          action: 'REFUND_SENT_TO_MIDTRANS',
          description: `Refund request ${params.id} was sent to Midtrans.`,
          metadata: {
            returnRequestId: params.id,
            refundReference: response.returnRequest.refundReference || '',
          },
        });
      }

      if (response?.returnRequest?.refundStatus === 'FAILED') {
        await writeAuditLog({
          user: authContext.user,
          module: 'SALES',
          action: 'REFUND_FAILED',
          description: `Refund request ${params.id} failed to send to Midtrans.`,
          metadata: {
            returnRequestId: params.id,
            refundFailureReason: response.returnRequest.refundFailureReason || '',
          },
        });
      }

      return NextResponse.json(response);
    } catch (error) {
      return buildOrderErrorResponse(error);
    }
  });
}
