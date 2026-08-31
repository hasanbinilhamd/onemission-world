import { NextResponse } from 'next/server';
import { missionContentService, MissionContentError } from '@/lib/mission/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildMissionErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof MissionContentError
    ? error
    : new MissionContentError({
        message: 'Mission content could not be loaded.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

/**
 * Public movement Mission content for the ecommerce frontend.
 * Exposes only published content, active options, and computed results —
 * never voter identities or admin-only data.
 */
export async function GET() {
  try {
    const response = await missionContentService.getPublicMissionContent();
    return NextResponse.json(response);
  } catch (error) {
    return buildMissionErrorResponse(error, 'MISSION_PUBLIC_FETCH_FAILED');
  }
}
