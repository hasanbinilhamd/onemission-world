import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { websiteContentService, WebsiteContentError } from '@/lib/website/service';

async function readRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function buildWebsiteErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof WebsiteContentError
    ? error
    : new WebsiteContentError({
        message: 'Something went wrong. Please try again later.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'settings', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const response = await websiteContentService.listAdminProductStoryItems();
      return NextResponse.json(response);
    } catch (error) {
      return buildWebsiteErrorResponse(error, 'WEBSITE_PRODUCT_STORY_FETCH_FAILED');
    }
  });
}

export async function PUT(request) {
  return withDevTiming(request, async () => {
    let authContext;

    try {
      authContext = await requireHqPermission(request, 'settings', 'manage_configuration');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const payload = await readRequestBody(request);
      const response = await websiteContentService.updateProductStoryItems({
        items: payload.items,
        user: authContext.user,
      });
      return NextResponse.json(response);
    } catch (error) {
      return buildWebsiteErrorResponse(error, 'WEBSITE_PRODUCT_STORY_UPDATE_FAILED');
    }
  });
}
