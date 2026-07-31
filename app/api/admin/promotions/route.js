import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { normalizePromotionError, promotionService } from '@/lib/promotions';

function buildPromotionErrorResponse(error) {
  const normalized = normalizePromotionError(error);
  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
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
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const url = new URL(request.url);
      const response = await promotionService.listAdminPromotions({
        query: {
          page: url.searchParams.get('page') || 1,
          limit: url.searchParams.get('limit') || 20,
          search: url.searchParams.get('search') || '',
          status: url.searchParams.get('status') || 'all',
          promotionType: url.searchParams.get('promotionType') || 'all',
          sortBy: url.searchParams.get('sortBy') || 'updatedAt',
          sortOrder: url.searchParams.get('sortOrder') || 'desc',
        },
      });
      return NextResponse.json(response);
    } catch (error) {
      return buildPromotionErrorResponse(error);
    }
  });
}

export async function POST(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'create');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const payload = await readRequestBody(request);
      const response = await promotionService.createPromotion({ input: payload });
      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      return buildPromotionErrorResponse(error);
    }
  });
}
