import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { missionContentService, MissionContentError } from '@/lib/mission/service';

function buildMissionErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof MissionContentError
    ? error
    : new MissionContentError({
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
      const missionId = request.nextUrl?.searchParams?.get('missionId') || '';
      const response = missionId
        ? await missionContentService.getAdminMissionDetail(missionId)
        : await missionContentService.getAdminMissionContent();
      return NextResponse.json(response);
    } catch (error) {
      return buildMissionErrorResponse(error, 'MISSION_ADMIN_FETCH_FAILED');
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

      if (action === 'createMission') {
        const response = await missionContentService.createMission({
          eyebrow: payload.eyebrow,
          title: payload.title,
          description: payload.description,
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (!payload.missionId) {
        return buildMissionErrorResponse(
          new MissionContentError({
            message: 'missionId is required.',
            statusCode: 400,
            code: 'MISSION_ID_REQUIRED',
          }),
          'MISSION_ID_REQUIRED',
        );
      }

      if (action === 'updateContent') {
        const response = await missionContentService.updateMissionContent({
          missionId: payload.missionId,
          content: payload.content || {},
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (action === 'replaceOptions') {
        const response = await missionContentService.replaceMissionOptions({
          missionId: payload.missionId,
          options: Array.isArray(payload.options) ? payload.options : [],
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      if (action === 'setStatus') {
        const response = await missionContentService.setMissionStatus({
          missionId: payload.missionId,
          status: payload.status,
          user: authContext.user,
        });
        return NextResponse.json(response);
      }

      return buildMissionErrorResponse(
        new MissionContentError({
          message: 'Unknown action. Supported: createMission, updateContent, replaceOptions, setStatus.',
          statusCode: 400,
          code: 'MISSION_ACTION_UNKNOWN',
        }),
        'MISSION_ACTION_UNKNOWN',
      );
    } catch (error) {
      return buildMissionErrorResponse(error, 'MISSION_ADMIN_UPDATE_FAILED');
    }
  });
}
