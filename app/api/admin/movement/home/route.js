import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { movementHomeContentService, MovementHomeContentError } from '@/lib/movement-home/service';

function buildMovementHomeErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof MovementHomeContentError
    ? error
    : new MovementHomeContentError({
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
      const response = await movementHomeContentService.getAdminHomeContent();
      return NextResponse.json(response);
    } catch (error) {
      return buildMovementHomeErrorResponse(error, 'MOVEMENT_HOME_ADMIN_FETCH_FAILED');
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
      const hasHome = payload && typeof payload === 'object' && 'home' in payload;
      const hasCards = payload && typeof payload === 'object' && 'cards' in payload;

      if (!hasHome && !hasCards) {
        return buildMovementHomeErrorResponse(
          new MovementHomeContentError({
            message: 'Provide either a "home" object or a "cards" array to update.',
            statusCode: 400,
            code: 'MOVEMENT_HOME_UPDATE_PAYLOAD_MISSING',
          }),
          'MOVEMENT_HOME_UPDATE_PAYLOAD_MISSING',
        );
      }

      if (hasHome) {
        await movementHomeContentService.updateHomePage({
          home: payload.home,
          user: authContext.user,
        });
      }

      if (hasCards) {
        await movementHomeContentService.updateHomeCards({
          cards: Array.isArray(payload.cards) ? payload.cards : [],
          user: authContext.user,
        });
      }

      const response = await movementHomeContentService.getAdminHomeContent();
      return NextResponse.json(response);
    } catch (error) {
      return buildMovementHomeErrorResponse(error, 'MOVEMENT_HOME_UPDATE_FAILED');
    }
  });
}
