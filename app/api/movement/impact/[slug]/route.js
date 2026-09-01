import { NextResponse } from 'next/server';
import { impactContentService, ImpactContentError } from '@/lib/impact/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildImpactErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof ImpactContentError
    ? error
    : new ImpactContentError({
        message: 'Impact content could not be loaded.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

/**
 * Public Impact detail. DRAFT content is rejected server-side (404) — never
 * exposed through the public API.
 */
export async function GET(request, { params }) {
  const slug = String(params?.slug || '');
  try {
    const response = await impactContentService.getPublicImpactStory(slug);
    return NextResponse.json(response);
  } catch (error) {
    return buildImpactErrorResponse(error, 'IMPACT_PUBLIC_DETAIL_FETCH_FAILED');
  }
}
