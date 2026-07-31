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

export async function GET(request, { params }) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const response = await promotionService.getAdminPromotionById(params.id);
      return NextResponse.json(response);
    } catch (error) {
      return buildPromotionErrorResponse(error);
    }
  });
}

export async function PUT(request, { params }) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'update');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const payload = await readRequestBody(request);
      const response = await promotionService.updatePromotion({ id: params.id, input: payload });
      return NextResponse.json(response);
    } catch (error) {
      return buildPromotionErrorResponse(error);
    }
  });
}

export async function DELETE(request, { params }) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'delete');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const response = await promotionService.deletePromotion(params.id);
      return NextResponse.json(response);
    } catch (error) {
      return buildPromotionErrorResponse(error);
    }
  });
}
