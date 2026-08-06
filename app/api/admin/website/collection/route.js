import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { WebsiteContentError, websiteContentService } from '@/lib/website/service';

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
      await requireHqPermission(request, 'settings', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const response = await websiteContentService.getAdminCollectionHero();
      return NextResponse.json(response);
    } catch (error) {
      return buildWebsiteErrorResponse(error);
    }
  });
}

export async function PUT(request) {
  return withDevTiming(request, async () => {
    let user;
    try {
      user = await requireHqPermission(request, 'settings', 'manage_configuration');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const payload = await readRequestBody(request);
      const response = await websiteContentService.updateCollectionHero({ data: payload, user });
      return NextResponse.json(response);
    } catch (error) {
      return buildWebsiteErrorResponse(error);
    }
  });
}
