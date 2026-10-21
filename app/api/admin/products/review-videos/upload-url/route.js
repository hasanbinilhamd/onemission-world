import { NextResponse } from 'next/server';
import { requireHqPermission } from '@/lib/hq-security';
import {
  createProductReviewVideoUpload,
  MovementImageUploadError,
} from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * Return a 15-minute, single-object R2 upload URL to authorized HQ staff.
 * Video bytes go from the browser straight to R2; the server never receives
 * the 20 MB payload. The final public URL is saved in Product Gallery (VIDEO).
 */
export async function POST(request) {
  try {
    await requireHqPermission(request, 'operations', 'update');
  } catch (error) {
    return NextResponse.json({ error: error.message, code: error.code }, {
      status: error.statusCode || 403,
    });
  }

  try {
    const body = await request.json();
    const result = createProductReviewVideoUpload({
      fileName: body.fileName,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
    });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const status = error instanceof MovementImageUploadError ? error.statusCode : 400;
    return NextResponse.json({
      error: error instanceof MovementImageUploadError ? error.message : 'Invalid video upload request.',
      code: error instanceof MovementImageUploadError ? error.code : 'REVIEW_VIDEO_UPLOAD_INVALID',
    }, { status });
  }
}
