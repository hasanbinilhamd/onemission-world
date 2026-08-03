import { NextResponse } from 'next/server';
import { authenticateCustomerRequest, normalizeCustomerAuthError } from '@/lib/customer-auth';
import { normalizePromotionError, promotionService } from '@/lib/promotions';

function getCustomerPromotionMessage(error) {
  switch (error.code) {
    case 'PROMOTION_NOT_FOUND':
    case 'PROMOTION_INVALID_CODE':
      return 'Voucher not found.';
    case 'PROMOTION_EXPIRED':
      return 'Voucher expired.';
    case 'PROMOTION_QUOTA_EXCEEDED':
    case 'PROMOTION_USAGE_LIMIT_REACHED':
      return 'Voucher is no longer available.';
    case 'PROMOTION_MINIMUM_PURCHASE_NOT_MET':
      return 'Minimum purchase requirement not met.';
    case 'PROMOTION_TARGET_NOT_MATCHED':
    case 'PROMOTION_INACTIVE':
    case 'PROMOTION_NOT_STARTED':
    default:
      return 'Voucher cannot be applied to this order.';
  }
}

function buildPromotionErrorResponse(error) {
  const normalized = normalizePromotionError(error);
  return NextResponse.json(
    { error: getCustomerPromotionMessage(normalized), code: normalized.code },
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
      code: payload.code || '',
      customerId: authenticatedCustomer?.customer?.id || '',
      customerEmail: authenticatedCustomer?.customer?.email || payload.customerEmail || '',
      subtotal: payload.subtotal,
      shippingCost: payload.shippingCost,
      items: payload.items || [],
      courier: payload.courier || '',
    });
    return NextResponse.json(response);
  } catch (error) {
    return buildPromotionErrorResponse(error);
  }
}
