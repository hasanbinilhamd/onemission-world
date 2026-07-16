import { NextResponse } from 'next/server';
import { authenticateCustomerRequest, normalizeCustomerAuthError } from '@/lib/customer-auth';
import { writeAuditLog } from '@/lib/hq-security';
import { normalizeOrderError, orderService } from '@/lib/order';

function buildOrderErrorResponse(error) {
  const normalized = normalizeOrderError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

function buildCustomerAuthErrorResponse(error) {
  const normalized = normalizeCustomerAuthError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

export async function POST(request, { params }) {
  let authenticatedCustomer = null;

  try {
    authenticatedCustomer = await authenticateCustomerRequest(request, { optional: true });
  } catch (error) {
    return buildCustomerAuthErrorResponse(error);
  }

  const payload = await request.json().catch(() => ({}));

  try {
    const order = await orderService.requestReturnByCustomer({
      orderId: params.id,
      customerEmail: authenticatedCustomer?.customer?.email || payload.email || '',
      reason: payload.reason,
      description: payload.description,
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    });

    await writeAuditLog({
      user: authenticatedCustomer?.customer ? {
        name: authenticatedCustomer.customer.customerName,
        email: authenticatedCustomer.customer.email,
      } : payload.email ? { email: payload.email } : null,
      module: 'SALES',
      action: 'CUSTOMER_RETURN_REQUESTED',
      description: `Customer submitted a return refund request for order ${order.publicOrderNumber || order.orderNumber || params.id}.`,
      metadata: {
        orderId: order.id,
        publicOrderNumber: order.publicOrderNumber,
        reason: payload.reason || '',
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    return buildOrderErrorResponse(error);
  }
}
