import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v4 as uuid } from 'uuid';

const COLLECTION_MODELS = {
  products: 'product',
  inventory: 'inventory',
  plans: 'plan',
  content: 'content',
  creators: 'creator',
  schools: 'school',
  timeline: 'timeline',
  finance: 'finance',
  events: 'event',
  notifications: 'notification',
  rawmaterials: 'rawMaterial',
  chartofaccounts: 'chartOfAccount',
};

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function handle(request, { params }) {
  const segs = params?.path || [];
  const method = request.method;

  try {
    // ---------- AUTH ----------
    if (segs[0] === 'auth' && segs[1] === 'login' && method === 'POST') {
      const { email, password } = await readJson(request);
      const user = await prisma.user.findFirst({ where: { email, password } });
      if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      return NextResponse.json({ user });
    }

    // ---------- USERS ----------
    if (segs[0] === 'users' && method === 'GET') {
      const users = await prisma.user.findMany();
      return NextResponse.json(users);
    }

    // ---------- DASHBOARD STATS ----------
    if (segs[0] === 'dashboard' && method === 'GET') {
      const [finance, products, inventory, content, events, creators, schools] = await Promise.all([
        prisma.finance.findMany(),
        prisma.product.findMany(),
        prisma.inventory.findMany(),
        prisma.content.findMany(),
        prisma.event.findMany(),
        prisma.creator.findMany(),
        prisma.school.findMany(),
      ]);
      const totalRevenue = finance.reduce((s, f) => s + f.revenue, 0);
      const totalExpenses = finance.reduce((s, f) => s + f.expenses, 0);
      const netProfit = totalRevenue - totalExpenses;
      const cashPosition = finance.reduce((s, f) => s + f.cashflow, 0);
      const last = finance[finance.length - 1];
      const prev = finance[finance.length - 2];
      const salesGrowth = prev ? ((last.revenue - prev.revenue) / prev.revenue * 100) : 0;
      const lowStock = inventory.filter((i) => i.quantity < i.threshold);
      return NextResponse.json({
        totalRevenue,
        monthlyRevenue: last?.revenue || 0,
        netProfit,
        expenses: totalExpenses,
        cashPosition,
        salesGrowth: Number(salesGrowth.toFixed(1)),
        lowStockCount: lowStock.length,
        productCount: products.length,
        eventCount: events.length,
        contentCount: content.length,
        creatorDeals: creators.filter((c) => c.status === 'Deal').length,
        schoolsInPipeline: schools.filter((s) => ['Negotiation', 'Meeting', 'Deal'].includes(s.status)).length,
      });
    }

    // ---------- RAW MATERIALS STATS ----------
    if (segs[0] === 'rawmaterials' && segs[1] === 'stats' && method === 'GET') {
      const items = await prisma.rawMaterial.findMany();
      const total = items.length;
      const totalWeight = items.reduce((s, i) => s + (i.weight || 0), 0);
      const uniqueColors = new Set(items.map(i => i.color.toLowerCase().trim())).size;
      return NextResponse.json({ total, totalWeight, uniqueColors });
    }

    // ---------- CHART OF ACCOUNTS — check code uniqueness ----------
    if (segs[0] === 'chartofaccounts' && segs[1] === 'check-code' && method === 'GET') {
      const url = new URL(request.url);
      const code = url.searchParams.get('code');
      const excludeId = url.searchParams.get('excludeId');
      const where = { accountCode: code };
      if (excludeId) where.id = { not: excludeId };
      const existing = await prisma.chartOfAccount.findFirst({ where });
      return NextResponse.json({ exists: !!existing });
    }

    // Generic CRUD
    const modelName = COLLECTION_MODELS[segs[0]];
    if (modelName) {
      const model = prisma[modelName];
      if (method === 'GET' && segs.length === 1) {
        const docs = await model.findMany({ orderBy: { accountCode: 'asc' } }).catch(() => model.findMany());
        return NextResponse.json(docs);
      }
      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        const doc = await model.create({ data: { id: uuid(), ...body } });
        return NextResponse.json(doc);
      }
      if (method === 'PUT' && segs.length === 2) {
        const body = await readJson(request);
        const id = segs[1];
        const updated = await model.update({ where: { id }, data: body });
        return NextResponse.json(updated);
      }
      if (method === 'DELETE' && segs.length === 2) {
        const id = segs[1];
        // Chart of Accounts: soft delete by setting isActive = false
        if (modelName === 'chartOfAccount') {
          const updated = await model.update({ where: { id }, data: { isActive: false } });
          return NextResponse.json(updated);
        }
        if (modelName === 'product') {
          await prisma.inventory.deleteMany({ where: { productId: id } });
        }
        await model.delete({ where: { id } });
        return NextResponse.json({ ok: true });
      }
    }

    // Public products endpoint (for ONEMISSION website integration)
    if (segs[0] === 'public' && segs[1] === 'products' && method === 'GET') {
      const products = await prisma.product.findMany({ where: { status: 'Active' } });
      const inventory = await prisma.inventory.findMany();
      const result = products.map((p) => ({
        ...p,
        stock: inventory.filter((i) => i.productId === p.id).reduce((s, i) => s + i.quantity, 0),
      }));
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Not found', segs }, { status: 404 });
  } catch (e) {
    console.error('API error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
