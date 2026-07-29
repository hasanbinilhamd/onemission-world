import { NextResponse } from 'next/server';
import { websiteContentService, WebsiteContentError } from '@/lib/website/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildWebsiteErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof WebsiteContentError
    ? error
    : new WebsiteContentError({
        message: 'Website brand video content could not be loaded.',
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
    const response = await websiteContentService.getPublicBrandVideo();
    return NextResponse.json(response);
  } catch (error) {
    return buildWebsiteErrorResponse(error, 'WEBSITE_PUBLIC_BRAND_VIDEO_FETCH_FAILED');
  }
}
