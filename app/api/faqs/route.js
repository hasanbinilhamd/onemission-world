export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { faqService, normalizeFaqError } from '@/lib/faq/service';

export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      const response = await faqService.listPublishedFaqs();
      return NextResponse.json(response);
    } catch (error) {
      const normalized = normalizeFaqError(error);
      return NextResponse.json({ error: normalized.message, code: normalized.code }, { status: normalized.statusCode || 500 });
    }
  });
}
