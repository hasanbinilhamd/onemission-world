import { NextResponse } from 'next/server';
import { websiteContentService, WebsiteContentError } from '@/lib/website/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildWebsiteErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof WebsiteContentError
    ? error
    : new WebsiteContentError({
        message: 'Website hero content could not be loaded.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

export async function GET() {
  try {
    const response = await websiteContentService.listPublicHeroItems();
    return NextResponse.json(response);
  } catch (error) {
    return buildWebsiteErrorResponse(error, 'WEBSITE_PUBLIC_HERO_FETCH_FAILED');
  }
}
