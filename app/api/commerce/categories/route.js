import { NextResponse } from 'next/server';
import { commerceProductService, normalizeCommerceProductError } from '@/lib/commerce';

function buildCommerceErrorResponse(error) {
  const normalized = normalizeCommerceProductError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 },
  );
}

export async function GET(request) {
  const url = new URL(request.url);

  try {
    const response = await commerceProductService.listCategories({
      baseUrl: url.origin,
    });
    return NextResponse.json(response);
  } catch (error) {
    return buildCommerceErrorResponse(error);
  }
}
