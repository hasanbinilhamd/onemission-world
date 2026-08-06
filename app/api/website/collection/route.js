import { NextResponse } from 'next/server';
import { WebsiteContentError, websiteContentService } from '@/lib/website/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildWebsiteErrorResponse(error) {
  const normalizedError = error instanceof WebsiteContentError
    ? error
    : new WebsiteContentError({
        message: 'Something went wrong. Please try again later.',
        statusCode: 500,
        code: 'WEBSITE_COLLECTION_HERO_FAILED',
      });
  return NextResponse.json({ error: normalizedError.message, code: normalizedError.code }, { status: normalizedError.statusCode || 500 });
}

export async function GET() {
  try {
    const response = await websiteContentService.getPublicCollectionHero();
    return NextResponse.json(response);
  } catch (error) {
    return buildWebsiteErrorResponse(error);
  }
}
