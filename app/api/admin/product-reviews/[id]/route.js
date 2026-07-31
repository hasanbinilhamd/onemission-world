import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { normalizeProductReviewError, productReviewService } from '@/lib/reviews';

function buildProductReviewErrorResponse(error) {
  const normalized = normalizeProductReviewError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

export async function GET(request, { params }) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const response = await productReviewService.getAdminProductReviewById(params.id);
      return NextResponse.json(response);
    } catch (error) {
      return buildProductReviewErrorResponse(error);
    }
  });
}

export async function DELETE(request, { params }) {
  return withDevTiming(request, async () => {
    let authContext;

    try {
      authContext = await requireHqPermission(request, 'marketing', 'delete');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const response = await productReviewService.deleteProductReview({
        id: params.id,
        user: authContext.user,
      });
      return NextResponse.json(response);
    } catch (error) {
      return buildProductReviewErrorResponse(error);
    }
  });
}
