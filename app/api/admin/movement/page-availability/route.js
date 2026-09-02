import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { pageAvailabilityService, PageAvailabilityError } from '@/lib/page-availability/service';

function buildErrorResponse(error, fallbackCode) {
  const normalized = error instanceof PageAvailabilityError
    ? error
    : new PageAvailabilityError({
        message: 'Something went wrong. Please try again later.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

async function readRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

/**
 * Shared admin endpoint for section-level page availability
 * (?page=mission|impact|donate). Reused by the Mission, Impact, and Donate
 * CMS modules — no separate authorization system, existing settings
 * permissions apply.
 */
export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'settings', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const page = request.nextUrl?.searchParams?.get('page') || '';
      const response = await pageAvailabilityService.getPageAvailability(page);
      return NextResponse.json(response);
    } catch (error) {
      return buildErrorResponse(error, 'PAGE_AVAILABILITY_FETCH_FAILED');
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
      const response = await pageAvailabilityService.setPageAvailability({
        page: payload.page,
        availability: payload.availability,
        user: authContext.user,
      });
      return NextResponse.json(response);
    } catch (error) {
      return buildErrorResponse(error, 'PAGE_AVAILABILITY_UPDATE_FAILED');
    }
  });
}
