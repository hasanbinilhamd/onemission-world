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
 * Public Impact listing for the ecommerce frontend.
 * Server performs: DRAFT exclusion, status filtering, status-priority
 * ordering + sort mode, and offset/limit pagination.
 */
export async function GET(request) {
  const params = request.nextUrl?.searchParams;
  try {
    const response = await impactContentService.getPublicImpactList({
      status: params?.get('status') || 'ALL',
      sort: params?.get('sort') || 'latest',
      offset: Number(params?.get('offset') || 0),
      limit: Number(params?.get('limit') || 12),
    });
    return NextResponse.json(response);
  } catch (error) {
    return buildImpactErrorResponse(error, 'IMPACT_PUBLIC_FETCH_FAILED');
  }
}
