import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { impactContentService, ImpactContentError } from '@/lib/impact/service';

function buildImpactErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof ImpactContentError
    ? error
    : new ImpactContentError({
        message: 'Something went wrong. Please try again later.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
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
      const storyId = request.nextUrl?.searchParams?.get('storyId') || '';
      const response = storyId
        ? await impactContentService.getAdminImpactStory(storyId)
        : await impactContentService.getAdminImpactContent();
      return NextResponse.json(response);
    } catch (error) {
      return buildImpactErrorResponse(error, 'IMPACT_ADMIN_FETCH_FAILED');
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
      const action = String(payload.action || '');

      if (action === 'updateSettings') {
        const response = await impactContentService.updateImpactSettings({
          settings: payload.settings || {},
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (action === 'createStory') {
        const response = await impactContentService.createImpactStory({
          story: payload.story || {},
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (!payload.storyId) {
        return buildImpactErrorResponse(
          new ImpactContentError({
            message: 'storyId is required.',
            statusCode: 400,
            code: 'IMPACT_STORY_ID_REQUIRED',
          }),
          'IMPACT_STORY_ID_REQUIRED',
        );
      }

      if (action === 'updateStory') {
        const response = await impactContentService.updateImpactStory({
          storyId: payload.storyId,
          story: payload.story || {},
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (action === 'replaceBlocks') {
        const response = await impactContentService.replaceImpactBlocks({
          storyId: payload.storyId,
          blocks: Array.isArray(payload.blocks) ? payload.blocks : [],
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (action === 'setStatus') {
        const response = await impactContentService.setImpactStatus({
          storyId: payload.storyId,
          status: payload.status,
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (action === 'setFeatured') {
        const response = await impactContentService.setImpactFeatured({
          storyId: payload.storyId,
          featured: payload.featured,
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      return buildImpactErrorResponse(
        new ImpactContentError({
          message: 'Unknown action. Supported: updateSettings, createStory, updateStory, replaceBlocks, setStatus, setFeatured.',
          statusCode: 400,
          code: 'IMPACT_ACTION_UNKNOWN',
        }),
        'IMPACT_ACTION_UNKNOWN',
      );
    } catch (error) {
      return buildImpactErrorResponse(error, 'IMPACT_ADMIN_UPDATE_FAILED');
    }
  });
}
