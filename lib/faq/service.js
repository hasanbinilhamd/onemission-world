import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';

export class FaqError extends Error {
  constructor({ message, statusCode = 400, code = 'FAQ_ERROR' }) {
    super(message);
    this.name = 'FaqError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizePositiveInteger(value, fallback = 1, max = 100) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'published'].includes(normalized)) return true;
    if (['false', '0', 'no', 'unpublished'].includes(normalized)) return false;
  }
  return fallback;
}

function buildFaqResponse(faq) {
  return {
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    category: faq.category || '',
    sortOrder: Number(faq.sortOrder || 0),
    isPublished: Boolean(faq.isPublished),
    createdAt: faq.createdAt,
    updatedAt: faq.updatedAt,
  };
}

function normalizeFaqInput(input = {}, { partial = false } = {}) {
  const question = String(input.question ?? '').trim();
  const answer = String(input.answer ?? '').trim();
  const category = String(input.category ?? '').trim();
  const sortOrderInput = input.sortOrder === undefined || input.sortOrder === null || input.sortOrder === '' ? 0 : Number(input.sortOrder);

  if (!partial || Object.prototype.hasOwnProperty.call(input, 'question')) {
    if (!question) {
      throw new FaqError({ message: 'Question is required.', statusCode: 400, code: 'FAQ_QUESTION_REQUIRED' });
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(input, 'answer')) {
    if (!answer) {
      throw new FaqError({ message: 'Answer is required.', statusCode: 400, code: 'FAQ_ANSWER_REQUIRED' });
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'sortOrder') && (!Number.isFinite(sortOrderInput) || sortOrderInput < 0)) {
    throw new FaqError({ message: 'Sort order must be a valid non-negative number.', statusCode: 400, code: 'FAQ_SORT_ORDER_INVALID' });
  }

  const data = {};
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'question')) data.question = question;
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'answer')) data.answer = answer;
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'category')) data.category = category;
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'sortOrder')) data.sortOrder = Math.floor(sortOrderInput || 0);
  if (!partial || Object.prototype.hasOwnProperty.call(input, 'isPublished')) data.isPublished = normalizeBoolean(input.isPublished, false);

  return data;
}

export class FaqService {
  constructor({ prismaClient = prisma, idGenerator = uuid } = {}) {
    this.prisma = prismaClient;
    this.idGenerator = idGenerator;
  }

  async listAdminFaqs({ page = 1, limit = 20, search = '', category = '', status = 'all' } = {}) {
    const normalizedPage = normalizePositiveInteger(page, 1, 1000);
    const normalizedLimit = normalizePositiveInteger(limit, 20, 100);
    const normalizedSearch = String(search || '').trim();
    const normalizedCategory = String(category || '').trim();
    const normalizedStatus = String(status || 'all').trim().toLowerCase();

    const where = {
      ...(normalizedSearch ? {
        OR: [
          { question: { contains: normalizedSearch, mode: 'insensitive' } },
          { answer: { contains: normalizedSearch, mode: 'insensitive' } },
        ],
      } : {}),
      ...(normalizedCategory && normalizedCategory !== 'all' ? { category: normalizedCategory } : {}),
      ...(normalizedStatus === 'published' ? { isPublished: true } : normalizedStatus === 'unpublished' ? { isPublished: false } : {}),
    };

    const [totalItems, faqs, categoryRows] = await Promise.all([
      this.prisma.faq.count({ where }),
      this.prisma.faq.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
      }),
      this.prisma.faq.findMany({
        select: { category: true },
        where: { category: { not: '' } },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      }),
    ]);

    return {
      data: faqs.map(buildFaqResponse),
      categories: categoryRows.map((row) => row.category).filter(Boolean),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / normalizedLimit)),
        hasNextPage: normalizedPage * normalizedLimit < totalItems,
        hasPreviousPage: normalizedPage > 1,
      },
    };
  }

  async listPublishedFaqs() {
    const faqs = await this.prisma.faq.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const categories = [...new Set(faqs.map((faq) => faq.category).filter(Boolean))].sort((left, right) => left.localeCompare(right));

    return {
      data: faqs.map(buildFaqResponse),
      categories,
    };
  }

  async createFaq(input = {}) {
    const data = normalizeFaqInput(input);
    const faq = await this.prisma.faq.create({
      data: {
        id: this.idGenerator(),
        ...data,
      },
    });
    return buildFaqResponse(faq);
  }

  async updateFaq(id, input = {}) {
    const faqId = String(id || '').trim();
    if (!faqId) {
      throw new FaqError({ message: 'FAQ id is required.', statusCode: 400, code: 'FAQ_ID_REQUIRED' });
    }

    const existing = await this.prisma.faq.findUnique({ where: { id: faqId } });
    if (!existing) {
      throw new FaqError({ message: 'FAQ was not found.', statusCode: 404, code: 'FAQ_NOT_FOUND' });
    }

    const data = normalizeFaqInput(input, { partial: true });
    const faq = await this.prisma.faq.update({ where: { id: faqId }, data });
    return buildFaqResponse(faq);
  }

  async deleteFaq(id) {
    const faqId = String(id || '').trim();
    if (!faqId) {
      throw new FaqError({ message: 'FAQ id is required.', statusCode: 400, code: 'FAQ_ID_REQUIRED' });
    }

    const existing = await this.prisma.faq.findUnique({ where: { id: faqId } });
    if (!existing) {
      throw new FaqError({ message: 'FAQ was not found.', statusCode: 404, code: 'FAQ_NOT_FOUND' });
    }

    await this.prisma.faq.delete({ where: { id: faqId } });
    return { success: true, id: faqId };
  }
}

export const faqService = new FaqService();

export function normalizeFaqError(error) {
  if (error instanceof FaqError) return error;
  return new FaqError({ message: 'FAQ request could not be completed.', statusCode: 500, code: 'FAQ_INTERNAL_ERROR' });
}
