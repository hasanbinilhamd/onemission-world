import { NextResponse } from 'next/server';
import { movementHomeContentService, MovementHomeContentError } from '@/lib/movement-home/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildMovementHomeErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof MovementHomeContentError
    ? error
    : new MovementHomeContentError({
        message: 'Home content could not be loaded.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

/**
 * Public movement Home content for the ecommerce frontend.
 * Returns the published Home hero + Join The Mission cards.
 */
export async function GET() {
  try {
    const response = await movementHomeContentService.getPublicHomeContent();
    return NextResponse.json(response);
  } catch (error) {
    return buildMovementHomeErrorResponse(error, 'MOVEMENT_HOME_PUBLIC_FETCH_FAILED');
  }
}
