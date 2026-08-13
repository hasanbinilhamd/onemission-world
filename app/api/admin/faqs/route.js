export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withDevTiming } from '@/lib/dev-timing';
import { requireHqPermission, writeAuditLog } from '@/lib/hq-security';
import { faqService, normalizeFaqError } from '@/lib/faq/service';

function buildFaqErrorResponse(error) {
  const normalized = normalizeFaqError(error);
  return NextResponse.json({ error: normalized.message, code: normalized.code }, { status: normalized.statusCode || 500 });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function GET(request) {
  return withDevTiming(request, async () => {
    try {
      await requireHqPermission(request, 'marketing', 'view');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const url = new URL(request.url);
      const response = await faqService.listAdminFaqs({
        page: url.searchParams.get('page') || 1,
        limit: url.searchParams.get('limit') || 20,
        search: url.searchParams.get('search') || '',
        category: url.searchParams.get('category') || 'all',
        status: url.searchParams.get('status') || 'all',
      });
      return NextResponse.json(response);
    } catch (error) {
      return buildFaqErrorResponse(error);
    }
  });
}

export async function POST(request) {
  return withDevTiming(request, async () => {
    let authContext;
    try {
      authContext = await requireHqPermission(request, 'marketing', 'create');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const payload = await readBody(request);
      const response = await faqService.createFaq(payload);
      await writeAuditLog({ user: authContext.user, module: 'MARKETING', action: 'FAQ_CREATED', description: `FAQ created: ${response.question}`, metadata: { faqId: response.id } });
      return NextResponse.json(response, { status: 201 });
    } catch (error) {
      return buildFaqErrorResponse(error);
    }
  });
}
