import { NextResponse } from 'next/server';
import { authenticateCustomerRequest, normalizeCustomerAuthError } from '@/lib/customer-auth';
import { normalizePromotionError, promotionService } from '@/lib/promotions';

function buildPromotionErrorResponse(error) {
  const normalized = normalizePromotionError(error);
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

async function readRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function POST(request) {
  let authenticatedCustomer = null;

  try {
    authenticatedCustomer = await authenticateCustomerRequest(request, { optional: true });
  } catch (error) {
    return buildCustomerAuthErrorResponse(error);
  }

  try {
    const payload = await readRequestBody(request);
    const response = await promotionService.validatePromotionPreview({
      code: payload.code,
      customerId: authenticatedCustomer?.customer?.id || '',
      customerEmail: authenticatedCustomer?.customer?.email || payload.customerEmail || '',
      subtotal: payload.subtotal,
      shippingCost: payload.shippingCost,
    });
    return NextResponse.json(response);
  } catch (error) {
    return buildPromotionErrorResponse(error);
  }
}
