import { NextResponse } from 'next/server';
import { authenticateCustomerRequest, normalizeCustomerAuthError } from '@/lib/customer-auth';
import { normalizeProductReviewError, productReviewService } from '@/lib/reviews';

function buildProductReviewErrorResponse(error) {
  const normalized = normalizeProductReviewError(error);
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

export async function GET(request) {
  const url = new URL(request.url);

  try {
    const response = await productReviewService.listPublicProductReviews({
      productId: url.searchParams.get('productId') || '',
      page: url.searchParams.get('page') || 1,
      limit: url.searchParams.get('limit') || 10,
    });

    return NextResponse.json(response);
  } catch (error) {
    return buildProductReviewErrorResponse(error);
  }
}

export async function POST(request) {
  let authenticatedCustomer;

  try {
    authenticatedCustomer = await authenticateCustomerRequest(request, { optional: false });
  } catch (error) {
    return buildCustomerAuthErrorResponse(error);
  }

  try {
    const payload = await readRequestBody(request);
    const response = await productReviewService.createProductReview({
      customer: authenticatedCustomer.customer,
      input: payload,
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return buildProductReviewErrorResponse(error);
  }
}
