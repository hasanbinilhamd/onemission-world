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

export async function PATCH(request, { params }) {
  return withDevTiming(request, async () => {
    let authContext;

    try {
      authContext = await requireHqPermission(request, 'marketing', 'update');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const response = await productReviewService.updatePublishedState({
        id: params.id,
        isPublished: true,
        user: authContext.user,
      });
      return NextResponse.json(response);
    } catch (error) {
      return buildProductReviewErrorResponse(error);
    }
  });
}
