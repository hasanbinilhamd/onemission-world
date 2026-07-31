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

export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const url = new URL(request.url);
      const response = await productReviewService.listAdminProductReviews({
        query: {
          page: url.searchParams.get('page') || 1,
          limit: url.searchParams.get('limit') || 20,
          search: url.searchParams.get('search') || '',
          productId: url.searchParams.get('productId') || '',
          rating: url.searchParams.get('rating') || '',
          status: url.searchParams.get('status') || 'all',
          dateFrom: url.searchParams.get('dateFrom') || '',
          dateTo: url.searchParams.get('dateTo') || '',
        },
      });

      return NextResponse.json(response);
    } catch (error) {
      return buildProductReviewErrorResponse(error);
    }
  });
}
