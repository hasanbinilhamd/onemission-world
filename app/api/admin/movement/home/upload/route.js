import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission } from '@/lib/hq-security';
import { uploadMovementImage, MovementImageUploadError } from '@/lib/imagekit';

export const dynamic = 'force-dynamic';

function buildUploadErrorResponse(error, fallbackCode) {
  const normalizedError = error instanceof MovementImageUploadError
    ? error
    : new MovementImageUploadError({
        message: 'Image upload failed. Please try again.',
        statusCode: 500,
        code: fallbackCode,
      });

  return NextResponse.json(
    { error: normalizedError.message, code: normalizedError.code },
    { status: normalizedError.statusCode || 500 },
  );
}

/**
 * HQ server-side ImageKit upload for the movement Home CMS.
 *
 * The IMAGEKIT_PRIVATE_KEY never reaches the browser: this endpoint receives
 * the multipart file, uploads it to ImageKit server-side, and returns only
 * the public URL/fileId for storage in the CMS record.
 */
export async function POST(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'settings', 'manage_configuration');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const formData = await request.formData();
      const file = formData.get('file');
      const field = String(formData.get('field') || '');

      if (!file || typeof file === 'string') {
        return buildUploadErrorResponse(
          new MovementImageUploadError({
            message: 'No file was provided.',
            statusCode: 400,
            code: 'IMAGE_UPLOAD_FILE_MISSING',
          }),
          'IMAGE_UPLOAD_FILE_MISSING',
        );
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const result = await uploadMovementImage({
        fileBuffer,
        mimeType: file.type,
        field,
      });

      return NextResponse.json({
        fileId: result.fileId,
        url: result.url,
        name: result.name,
        folder: result.folder,
      });
    } catch (error) {
      return buildUploadErrorResponse(error, 'IMAGEKIT_UPLOAD_FAILED');
    }
  });
}
