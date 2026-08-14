import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { earlyAccessService, normalizeEarlyAccessError } from '@/lib/early-access/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function readBody(request) {
  try { return await request.json(); } catch { return {}; }
}

export async function POST(request) {
  return withDevTiming(request, async () => {
    try {
      const payload = await readBody(request);
      return NextResponse.json(await earlyAccessService.verifyPassword(payload.password || ''));
    } catch (error) {
      const normalized = normalizeEarlyAccessError(error);
      return NextResponse.json({ error: normalized.message, code: normalized.code }, { status: normalized.statusCode || 500 });
    }
  });
}
