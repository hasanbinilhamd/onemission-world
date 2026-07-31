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

export async function POST(request, { params }) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'create');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const response = await promotionService.duplicatePromotion(params.id);
      return NextResponse.json(response);
    } catch (error) {
      return buildPromotionErrorResponse(error);
    }
  });
}
