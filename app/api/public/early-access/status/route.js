import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { earlyAccessService, normalizeEarlyAccessError } from '@/lib/early-access/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      return NextResponse.json(await earlyAccessService.getPublicStatus());
    } catch (error) {
      const normalized = normalizeEarlyAccessError(error);
      return NextResponse.json({ error: normalized.message, code: normalized.code }, { status: normalized.statusCode || 500 });
    }
  });
}
