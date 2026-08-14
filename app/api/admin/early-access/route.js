import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission, writeAuditLog } from '@/lib/hq-security';
import { earlyAccessService, normalizeEarlyAccessError } from '@/lib/early-access/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function errorResponse(error) {
  const normalized = normalizeEarlyAccessError(error);
  return NextResponse.json({ error: normalized.message, code: normalized.code }, { status: normalized.statusCode || 500 });
}

async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'settings', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      return NextResponse.json(await earlyAccessService.getAdminConfig());
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function PATCH(request) {
  return withDevTiming(request, async () => {
    let authContext;
    try {
      authContext = await requireHqPermission(request, 'settings', 'manage_configuration');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const payload = await readBody(request);
      const response = await earlyAccessService.updateConfig(payload);
      await writeAuditLog({
        user: authContext.user,
        module: 'SETTINGS',
        action: 'EARLY_ACCESS_UPDATED',
        description: `Early Access settings updated for ${response.chapter}.`,
        metadata: { enabled: response.enabled, chapter: response.chapter, revision: response.revision },
      });
      return NextResponse.json(response);
    } catch (error) {
      return errorResponse(error);
    }
  });
}
