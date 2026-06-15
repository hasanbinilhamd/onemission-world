import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { v4 as uuid } from 'uuid';
import {
  SEED_USERS, SEED_PRODUCTS, SEED_INVENTORY, SEED_PLANS, SEED_CONTENT,
  SEED_CREATORS, SEED_SCHOOLS, SEED_TIMELINE, SEED_FINANCE, SEED_EVENTS, SEED_NOTIFICATIONS
} from '@/lib/seed-data';

async function ensureSeed() {
  const db = await getDb();
  const meta = await db.collection('_meta').findOne({ key: 'seeded_v1' });
  if (meta) return db;
  await db.collection('users').insertMany(SEED_USERS);
  await db.collection('products').insertMany(SEED_PRODUCTS);
  const productIds = SEED_PRODUCTS.map(p => p.id);
  await db.collection('inventory').insertMany(SEED_INVENTORY(productIds));
  await db.collection('plans').insertMany(SEED_PLANS);
  await db.collection('content').insertMany(SEED_CONTENT);
  await db.collection('creators').insertMany(SEED_CREATORS);
  await db.collection('schools').insertMany(SEED_SCHOOLS);
  await db.collection('timeline').insertMany(SEED_TIMELINE);
  await db.collection('finance').insertMany(SEED_FINANCE);
  await db.collection('events').insertMany(SEED_EVENTS);
  await db.collection('notifications').insertMany(SEED_NOTIFICATIONS);
  await db.collection('_meta').insertOne({ key: 'seeded_v1', at: new Date().toISOString() });
  return db;
}

function strip(doc) { if (!doc) return doc; const { _id, ...rest } = doc; return rest; }
function stripList(arr) { return arr.map(strip); }

async function readJson(request) { try { return await request.json(); } catch { return {}; } }

async function handle(request, { params }) {
  const db = await ensureSeed();
  const segs = params?.path || [];
  const method = request.method;
  const url = new URL(request.url);

  try {
    // ---------- AUTH ----------
    if (segs[0] === 'auth' && segs[1] === 'login' && method === 'POST') {
      const { email, password } = await readJson(request);
      const user = await db.collection('users').findOne({ email, password });
      if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      return NextResponse.json({ user: strip(user) });
    }

    // ---------- USERS ----------
    if (segs[0] === 'users' && method === 'GET') {
      const users = await db.collection('users').find({}).toArray();
      return NextResponse.json(stripList(users));
    }

    // ---------- DASHBOARD STATS ----------
    if (segs[0] === 'dashboard' && method === 'GET') {
      const [finance, products, inventory, content, events, creators, schools] = await Promise.all([
        db.collection('finance').find({}).toArray(),
        db.collection('products').find({}).toArray(),
        db.collection('inventory').find({}).toArray(),
        db.collection('content').find({}).toArray(),
        db.collection('events').find({}).toArray(),
        db.collection('creators').find({}).toArray(),
        db.collection('schools').find({}).toArray(),
      ]);
      const totalRevenue = finance.reduce((s,f)=>s+f.revenue,0);
      const totalExpenses = finance.reduce((s,f)=>s+f.expenses,0);
      const netProfit = totalRevenue - totalExpenses;
      const cashPosition = finance.reduce((s,f)=>s+f.cashflow,0);
      const last = finance[finance.length-1];
      const prev = finance[finance.length-2];
      const salesGrowth = prev ? ((last.revenue - prev.revenue)/prev.revenue*100) : 0;
      const lowStock = inventory.filter(i => i.quantity < i.threshold);
      return NextResponse.json({
        totalRevenue, monthlyRevenue: last?.revenue || 0, netProfit, expenses: totalExpenses, cashPosition,
        salesGrowth: Number(salesGrowth.toFixed(1)),
        lowStockCount: lowStock.length,
        productCount: products.length, eventCount: events.length, contentCount: content.length,
        creatorDeals: creators.filter(c=>c.status==='Deal').length,
        schoolsInPipeline: schools.filter(s=>['Negotiation','Meeting','Deal'].includes(s.status)).length,
      });
    }

    // Generic CRUD factory
    const collectionMap = {
      products: 'products',
      inventory: 'inventory',
      plans: 'plans',
      content: 'content',
      creators: 'creators',
      schools: 'schools',
      timeline: 'timeline',
      finance: 'finance',
      events: 'events',
      notifications: 'notifications',
    };
    const col = collectionMap[segs[0]];
    if (col) {
      const collection = db.collection(col);
      if (method === 'GET' && segs.length === 1) {
        const docs = await collection.find({}).toArray();
        return NextResponse.json(stripList(docs));
      }
      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        const doc = { id: uuid(), ...body };
        await collection.insertOne(doc);
        return NextResponse.json(strip(doc));
      }
      if (method === 'PUT' && segs.length === 2) {
        const body = await readJson(request);
        const id = segs[1];
        await collection.updateOne({ id }, { $set: body });
        const updated = await collection.findOne({ id });
        return NextResponse.json(strip(updated));
      }
      if (method === 'DELETE' && segs.length === 2) {
        await collection.deleteOne({ id: segs[1] });
        return NextResponse.json({ ok: true });
      }
    }

    // Public products endpoint (for ONEMISSION website integration)
    if (segs[0] === 'public' && segs[1] === 'products' && method === 'GET') {
      const products = await db.collection('products').find({ status: 'Active' }).toArray();
      const inventory = await db.collection('inventory').find({}).toArray();
      const result = products.map(p => ({
        ...strip(p),
        stock: inventory.filter(i => i.productId === p.id).reduce((s,i)=>s+i.quantity,0),
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
