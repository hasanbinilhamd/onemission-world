import { NextResponse } from 'next/server';
import { commerceProductService, normalizeCommerceProductError } from '@/lib/commerce';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildCommerceErrorResponse(error) {
  const normalized = normalizeCommerceProductError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

export async function GET(request) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());

  try {
    const response = await commerceProductService.listNewArrivalProducts({
      query,
      baseUrl: url.origin,
    });
    return NextResponse.json(response);
  } catch (error) {
    return buildCommerceErrorResponse(error);
  }
}
