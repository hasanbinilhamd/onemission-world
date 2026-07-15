import { NextResponse } from 'next/server';
import { checkoutService, normalizeCheckoutError } from '@/lib/checkout';

function buildCheckoutErrorResponse(error) {
  const normalized = normalizeCheckoutError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

export async function GET(_request, { params }) {
  try {
    const session = await checkoutService.getCheckoutSessionStateById(params.id);
    return NextResponse.json(session);
  } catch (error) {
    return buildCheckoutErrorResponse(error);
  }
}
