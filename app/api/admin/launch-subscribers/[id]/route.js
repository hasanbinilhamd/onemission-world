import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { launchSubscriberService, LaunchSubscriberError } from '@/lib/launch-subscribers/service';

function buildErrorResponse(error, fallbackCode) {
  const normalized = error instanceof LaunchSubscriberError
    ? error
    : new LaunchSubscriberError({
        message: 'Something went wrong. Please try again later.',
        statusCode: 500,
        code: fallbackCode,
      });
  return NextResponse.json({ error: normalized.message, code: normalized.code }, { status: normalized.statusCode || 500 });
}

async function readRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function GET(request, { params }) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const response = await launchSubscriberService.getById(params.id);
      return NextResponse.json(response);
    } catch (error) {
      return buildErrorResponse(error, 'LAUNCH_SUBSCRIBER_ADMIN_DETAIL_FAILED');
    }
  });
}

export async function PATCH(request, { params }) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'update');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const payload = await readRequestBody(request);
      const response = await launchSubscriberService.update({ id: params.id, input: payload });
      return NextResponse.json(response);
    } catch (error) {
      return buildErrorResponse(error, 'LAUNCH_SUBSCRIBER_ADMIN_UPDATE_FAILED');
    }
  });
}

export async function DELETE(request, { params }) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'delete');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const response = await launchSubscriberService.softDelete(params.id);
      return NextResponse.json(response);
    } catch (error) {
      return buildErrorResponse(error, 'LAUNCH_SUBSCRIBER_ADMIN_DELETE_FAILED');
    }
  });
}
