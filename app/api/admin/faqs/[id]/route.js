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

export async function PATCH(request, { params }) {
  return withDevTiming(request, async () => {
    let authContext;
    try {
      authContext = await requireHqPermission(request, 'marketing', 'update');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const payload = await readBody(request);
      const response = await faqService.updateFaq(params.id, payload);
      await writeAuditLog({ user: authContext.user, module: 'MARKETING', action: 'FAQ_UPDATED', description: `FAQ updated: ${response.question}`, metadata: { faqId: response.id, isPublished: response.isPublished } });
      return NextResponse.json(response);
    } catch (error) {
      return buildFaqErrorResponse(error);
    }
  });
}

export async function DELETE(request, { params }) {
  return withDevTiming(request, async () => {
    let authContext;
    try {
      authContext = await requireHqPermission(request, 'marketing', 'delete');
    } catch (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode || 403 });
    }

    try {
      const response = await faqService.deleteFaq(params.id);
      await writeAuditLog({ user: authContext.user, module: 'MARKETING', action: 'FAQ_DELETED', description: `FAQ deleted: ${params.id}`, metadata: { faqId: params.id } });
      return NextResponse.json(response);
    } catch (error) {
      return buildFaqErrorResponse(error);
    }
  });
}
