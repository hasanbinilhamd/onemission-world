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
  financialaccounts: 'financialAccount',
};

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// Generate journal number: JR-YYYYMM-00001
async function generateJournalNumber(journalDate) {
  const d = journalDate ? new Date(journalDate) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const prefix = `JR-${year}${month}-`;

  const existing = await prisma.journalEntry.findMany({
    where: { journalNumber: { startsWith: prefix } },
    select: { journalNumber: true },
    orderBy: { journalNumber: 'desc' },
  });

  let maxSeq = 0;
  for (const e of existing) {
    const parts = e.journalNumber.split('-');
    const seq = parseInt(parts[parts.length - 1] || '0', 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }

  return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
}

// Generate supplier code: SUP-0001
async function generateBomCode() {
  const existing = await prisma.bOM.findMany({
    select: { bomCode: true },
    orderBy: { bomCode: 'desc' },
  });
  let maxSeq = 0;
  for (const b of existing) {
    const parts = b.bomCode.split('-');
    const seq = parseInt(parts[parts.length - 1] || '0', 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `BOM-${String(maxSeq + 1).padStart(4, '0')}`;
}

async function generateSupplierCode() {
  const existing = await prisma.supplier.findMany({
    select: { supplierCode: true },
    orderBy: { supplierCode: 'desc' },
  });
  let maxSeq = 0;
  for (const s of existing) {
    const parts = s.supplierCode.split('-');
    const seq = parseInt(parts[parts.length - 1] || '0', 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `SUP-${String(maxSeq + 1).padStart(4, '0')}`;
}

// Generate stock movement reference: SM-YYYYMM-00001
async function generateStockMovementRef(movementDate) {
  const d = movementDate ? new Date(movementDate) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const prefix = `SM-${year}${month}-`;
  const existing = await prisma.stockMovement.findMany({
    where: { referenceNumber: { startsWith: prefix } },
    select: { referenceNumber: true },
    orderBy: { referenceNumber: 'desc' },
  });
  let maxSeq = 0;
  for (const e of existing) {
    const parts = e.referenceNumber.split('-');
    const seq = parseInt(parts[parts.length - 1] || '0', 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `${prefix}${String(maxSeq + 1).padStart(5, '0')}`;
}

// Build journal lines for a cash transaction
function buildCashJournalLines(txnType, faLinkedCoaId, chartOfAccountId, amount, description) {
  const note = description?.trim() || '';
  if (txnType === 'IN') {
    return [
      { chartOfAccountId: faLinkedCoaId, description: note, debitAmount: amount, creditAmount: 0 },
      { chartOfAccountId, description: note, debitAmount: 0, creditAmount: amount },
    ];
  } else {
    return [
      { chartOfAccountId, description: note, debitAmount: amount, creditAmount: 0 },
      { chartOfAccountId: faLinkedCoaId, description: note, debitAmount: 0, creditAmount: amount },
    ];
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
      const lowStockCount = items.filter(i => (i.currentStock || 0) <= (i.minimumStock || 0) && (i.minimumStock || 0) > 0).length;
      const totalInventoryValue = items.reduce((s, i) => s + ((i.unitCost || 0) * (i.currentStock || 0)), 0);
      const activeCount = items.filter(i => (i.status || 'Active') === 'Active').length;
      return NextResponse.json({ total, totalWeight, uniqueColors, lowStockCount, totalInventoryValue, activeCount });
    }

    // ---------- RAW MATERIALS LIST (with supplier) ----------
    if (segs[0] === 'rawmaterials' && method === 'GET' && segs.length === 1) {
      const items = await prisma.rawMaterial.findMany({
        include: { supplier: { select: { id: true, supplierCode: true, supplierName: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(items);
    }

    // ---------- SUPPLIERS ----------
    if (segs[0] === 'suppliers') {
      // Stats
      if (segs[1] === 'stats' && method === 'GET') {
        const all = await prisma.supplier.findMany({ select: { status: true } });
        const total = all.length;
        const active = all.filter(s => (s.status || 'Active') === 'Active').length;
        const inactive = all.filter(s => s.status === 'Inactive').length;
        return NextResponse.json({ total, active, inactive });
      }

      // List
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const search = url.searchParams.get('search');
        const status = url.searchParams.get('status');
        const where = {};
        if (status && status !== 'all') where.status = status;
        const suppliers = await prisma.supplier.findMany({
          where,
          include: { _count: { select: { rawMaterials: true } } },
          orderBy: { supplierCode: 'asc' },
        });
        const result = search
          ? suppliers.filter(s => {
              const q = search.toLowerCase();
              return s.supplierCode.toLowerCase().includes(q)
                || s.supplierName.toLowerCase().includes(q)
                || (s.contactPerson || '').toLowerCase().includes(q);
            })
          : suppliers;
        return NextResponse.json(result);
      }

      // Get by ID (with rawMaterials)
      if (method === 'GET' && segs.length === 2) {
        const supplier = await prisma.supplier.findUnique({
          where: { id: segs[1] },
          include: { rawMaterials: { orderBy: { name: 'asc' } } },
        });
        if (!supplier) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
        return NextResponse.json(supplier);
      }

      // Create
      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        if (!body.supplierName?.trim()) return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
        const supplierCode = await generateSupplierCode();
        const supplier = await prisma.supplier.create({
          data: {
            id: uuid(),
            supplierCode,
            supplierName: body.supplierName.trim(),
            contactPerson: body.contactPerson || '',
            phone: body.phone || '',
            email: body.email || '',
            address: body.address || '',
            city: body.city || '',
            province: body.province || '',
            country: body.country || 'Indonesia',
            leadTimeDays: Number(body.leadTimeDays) || 0,
            notes: body.notes || '',
            status: body.status || 'Active',
          },
        });
        return NextResponse.json(supplier);
      }

      // Update
      if (method === 'PUT' && segs.length === 2) {
        const body = await readJson(request);
        if (body.supplierName !== undefined && !body.supplierName?.trim()) {
          return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
        }
        const { id: _id, supplierCode: _code, createdAt: _ca, updatedAt: _ua, ...rest } = body;
        const updated = await prisma.supplier.update({ where: { id: segs[1] }, data: rest });
        return NextResponse.json(updated);
      }

      // Delete
      if (method === 'DELETE' && segs.length === 2) {
        await prisma.rawMaterial.updateMany({ where: { supplierId: segs[1] }, data: { supplierId: null } });
        await prisma.supplier.delete({ where: { id: segs[1] } });
        return NextResponse.json({ ok: true });
      }
    }

    // ---------- FINANCIAL ACCOUNTS — explicit GET + check-name ----------
    if (segs[0] === 'financialaccounts' && segs[1] === 'check-name' && method === 'GET') {
      const url = new URL(request.url);
      const name = url.searchParams.get('name');
      const excludeId = url.searchParams.get('excludeId');
      const where = { name };
      if (excludeId) where.id = { not: excludeId };
      const existing = await prisma.financialAccount.findFirst({ where });
      return NextResponse.json({ exists: !!existing });
    }
    if (segs[0] === 'financialaccounts' && method === 'GET' && segs.length === 1) {
      const docs = await prisma.financialAccount.findMany({
        orderBy: { name: 'asc' },
        include: { linkedCoa: { select: { id: true, accountCode: true, accountName: true } } },
      });
      return NextResponse.json(docs);
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

    // ---------- CASH TRANSACTIONS ----------
    if (segs[0] === 'cashtransactions') {
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const type = url.searchParams.get('type');
        const where = type ? { transactionType: type } : {};
        const docs = await prisma.cashTransaction.findMany({
          where,
          include: { financialAccount: true, chartOfAccount: true },
          orderBy: { transactionDate: 'desc' },
        });
        return NextResponse.json(docs);
      }

      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        if (!body.transactionDate)
          return NextResponse.json({ error: 'transactionDate is required' }, { status: 400 });
        if (!body.financialAccountId)
          return NextResponse.json({ error: 'financialAccount is required' }, { status: 400 });
        if (!body.chartOfAccountId)
          return NextResponse.json({ error: 'chartOfAccount is required' }, { status: 400 });
        if (!body.amount || Number(body.amount) <= 0)
          return NextResponse.json({ error: 'amount must be greater than 0' }, { status: 400 });

        const coa = await prisma.chartOfAccount.findUnique({ where: { id: body.chartOfAccountId } });
        if (!coa || !coa.allowTransaction)
          return NextResponse.json({ error: 'Selected account does not allow transactions' }, { status: 400 });

        const fa = await prisma.financialAccount.findUnique({ where: { id: body.financialAccountId } });
        if (!fa || !fa.isActive)
          return NextResponse.json({ error: 'Financial account is inactive or not found' }, { status: 400 });
        if (!fa.linkedCoaId)
          return NextResponse.json({
            error: 'Financial account has no linked COA account. Please configure it in Financial Accounts settings.',
          }, { status: 400 });

        const doc = await prisma.cashTransaction.create({
          data: {
            id: uuid(),
            transactionDate: body.transactionDate,
            transactionType: body.transactionType,
            financialAccountId: body.financialAccountId,
            chartOfAccountId: body.chartOfAccountId,
            amount: Number(body.amount),
            referenceNumber: body.referenceNumber || '',
            description: body.description || '',
            attachment: body.attachment || '',
            createdBy: body.createdBy || '',
          },
          include: { financialAccount: true, chartOfAccount: true },
        });

        // Auto-create journal entry (Posted, System)
        const journalNumber = await generateJournalNumber(body.transactionDate);
        const amount = Number(body.amount);
        const txnLabel = body.transactionType === 'IN' ? 'Cash In' : 'Cash Out';
        const journalDesc = `${txnLabel}: ${body.description?.trim() || body.referenceNumber?.trim() || fa.name}`;
        const lines = buildCashJournalLines(
          body.transactionType, fa.linkedCoaId, body.chartOfAccountId, amount, journalDesc
        );

        await prisma.journalEntry.create({
          data: {
            id: uuid(),
            journalNumber,
            journalDate: body.transactionDate,
            description: journalDesc,
            referenceNumber: body.referenceNumber || '',
            journalSource: txnLabel,
            sourceId: doc.id,
            journalType: 'System',
            status: 'Posted',
            totalDebit: amount,
            totalCredit: amount,
            createdBy: body.createdBy || '',
            lines: {
              create: lines.map((l) => ({ id: uuid(), ...l })),
            },
          },
        });

        return NextResponse.json(doc);
      }

      if (method === 'PUT' && segs.length === 2) {
        const body = await readJson(request);
        if (body.amount !== undefined && Number(body.amount) <= 0)
          return NextResponse.json({ error: 'amount must be greater than 0' }, { status: 400 });

        if (body.chartOfAccountId) {
          const coa = await prisma.chartOfAccount.findUnique({ where: { id: body.chartOfAccountId } });
          if (!coa || !coa.allowTransaction)
            return NextResponse.json({ error: 'Selected account does not allow transactions' }, { status: 400 });
        }

        // Validate FA has linked COA
        const existingTxn = await prisma.cashTransaction.findUnique({ where: { id: segs[1] } });
        const faId = body.financialAccountId || existingTxn?.financialAccountId;
        const fa = faId ? await prisma.financialAccount.findUnique({ where: { id: faId } }) : null;

        if (fa && !fa.linkedCoaId)
          return NextResponse.json({
            error: 'Financial account has no linked COA account. Please configure it in Financial Accounts settings.',
          }, { status: 400 });

        const updateData = {};
        if (body.transactionDate !== undefined) updateData.transactionDate = body.transactionDate;
        if (body.financialAccountId !== undefined) updateData.financialAccountId = body.financialAccountId;
        if (body.chartOfAccountId !== undefined) updateData.chartOfAccountId = body.chartOfAccountId;
        if (body.amount !== undefined) updateData.amount = Number(body.amount);
        if (body.referenceNumber !== undefined) updateData.referenceNumber = body.referenceNumber;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.attachment !== undefined) updateData.attachment = body.attachment;
        if (body.createdBy !== undefined) updateData.createdBy = body.createdBy;

        const updated = await prisma.cashTransaction.update({
          where: { id: segs[1] },
          data: updateData,
          include: { financialAccount: true, chartOfAccount: true },
        });

        // Sync system journal if it exists
        const journal = await prisma.journalEntry.findFirst({
          where: { sourceId: segs[1], journalType: 'System' },
        });

        if (journal && fa?.linkedCoaId) {
          const amount = updated.amount;
          const txnLabel = updated.transactionType === 'IN' ? 'Cash In' : 'Cash Out';
          const journalDesc = `${txnLabel}: ${updated.description?.trim() || updated.referenceNumber?.trim() || updated.financialAccount?.name || ''}`;
          const newLines = buildCashJournalLines(
            updated.transactionType, fa.linkedCoaId, updated.chartOfAccountId, amount, journalDesc
          );

          await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: journal.id } });
          await prisma.journalEntry.update({
            where: { id: journal.id },
            data: {
              journalDate: updated.transactionDate,
              description: journalDesc,
              referenceNumber: updated.referenceNumber || '',
              totalDebit: amount,
              totalCredit: amount,
              lines: {
                create: newLines.map((l) => ({ id: uuid(), ...l })),
              },
            },
          });
        }

        return NextResponse.json(updated);
      }

      if (method === 'DELETE' && segs.length === 2) {
        // Remove related system journal first (cascade lines via DB)
        const journal = await prisma.journalEntry.findFirst({
          where: { sourceId: segs[1], journalType: 'System' },
        });
        if (journal) {
          await prisma.journalEntry.delete({ where: { id: journal.id } });
        }

        await prisma.cashTransaction.delete({ where: { id: segs[1] } });
        return NextResponse.json({ ok: true });
      }
    }

    // ---------- JOURNAL ENTRIES ----------
    if (segs[0] === 'journalentries') {
      // GET /journalentries/next-number
      if (segs[1] === 'next-number' && method === 'GET') {
        const url = new URL(request.url);
        const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
        const number = await generateJournalNumber(date);
        return NextResponse.json({ journalNumber: number });
      }

      // POST /journalentries/:id/post
      if (segs.length === 3 && segs[2] === 'post' && method === 'POST') {
        const entry = await prisma.journalEntry.findUnique({ where: { id: segs[1] } });
        if (!entry) return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
        if (entry.status === 'Posted')
          return NextResponse.json({ error: 'Journal entry is already posted' }, { status: 400 });
        if (entry.journalType === 'System')
          return NextResponse.json({ error: 'System-generated journals cannot be manually posted' }, { status: 400 });
        const updated = await prisma.journalEntry.update({
          where: { id: segs[1] },
          data: { status: 'Posted' },
          include: { lines: { include: { chartOfAccount: true } } },
        });
        return NextResponse.json(updated);
      }

      // GET /journalentries — list
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        const source = url.searchParams.get('source');
        const journalType = url.searchParams.get('journalType');
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');

        const where = {};
        if (status && status !== 'all') where.status = status;
        if (source && source !== 'all') where.journalSource = source;
        if (journalType && journalType !== 'all') where.journalType = journalType;
        if (from || to) {
          where.journalDate = {};
          if (from) where.journalDate.gte = from;
          if (to) where.journalDate.lte = to;
        }

        const docs = await prisma.journalEntry.findMany({
          where,
          include: { lines: { include: { chartOfAccount: true } } },
          orderBy: { journalDate: 'desc' },
        });
        return NextResponse.json(docs);
      }

      // GET /journalentries/:id
      if (method === 'GET' && segs.length === 2) {
        const entry = await prisma.journalEntry.findUnique({
          where: { id: segs[1] },
          include: { lines: { include: { chartOfAccount: true } } },
        });
        if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(entry);
      }

      // POST /journalentries — create (Manual only)
      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);

        if (!body.journalDate)
          return NextResponse.json({ error: 'Journal date is required' }, { status: 400 });
        if (!body.description?.trim())
          return NextResponse.json({ error: 'Description is required' }, { status: 400 });
        if (!body.journalSource)
          return NextResponse.json({ error: 'Journal source is required' }, { status: 400 });

        const lines = body.lines || [];
        if (lines.length < 2)
          return NextResponse.json({ error: 'Minimum 2 journal lines are required' }, { status: 400 });

        for (const line of lines) {
          if (!line.chartOfAccountId)
            return NextResponse.json({ error: 'Each line must have an account selected' }, { status: 400 });
          const debit = Number(line.debitAmount) || 0;
          const credit = Number(line.creditAmount) || 0;
          if (debit > 0 && credit > 0)
            return NextResponse.json({ error: 'A line cannot have both debit and credit values' }, { status: 400 });
          const coa = await prisma.chartOfAccount.findUnique({ where: { id: line.chartOfAccountId } });
          if (!coa || !coa.allowTransaction)
            return NextResponse.json({ error: 'Selected account does not allow transactions' }, { status: 400 });
        }

        const totalDebit = lines.reduce((s, l) => s + (Number(l.debitAmount) || 0), 0);
        const totalCredit = lines.reduce((s, l) => s + (Number(l.creditAmount) || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01)
          return NextResponse.json({ error: 'Total debit must equal total credit' }, { status: 400 });

        const journalNumber = await generateJournalNumber(body.journalDate);

        const entry = await prisma.journalEntry.create({
          data: {
            id: uuid(),
            journalNumber,
            journalDate: body.journalDate,
            description: body.description.trim(),
            referenceNumber: body.referenceNumber?.trim() || '',
            journalSource: body.journalSource,
            sourceId: body.sourceId?.trim() || '',
            journalType: 'Manual',
            status: 'Draft',
            totalDebit,
            totalCredit,
            createdBy: body.createdBy?.trim() || '',
            lines: {
              create: lines.map((l) => ({
                id: uuid(),
                chartOfAccountId: l.chartOfAccountId,
                description: l.description?.trim() || '',
                debitAmount: Number(l.debitAmount) || 0,
                creditAmount: Number(l.creditAmount) || 0,
              })),
            },
          },
          include: { lines: { include: { chartOfAccount: true } } },
        });

        return NextResponse.json(entry);
      }

      // PUT /journalentries/:id — update (Manual Draft only)
      if (method === 'PUT' && segs.length === 2) {
        const existing = await prisma.journalEntry.findUnique({ where: { id: segs[1] } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (existing.journalType === 'System')
          return NextResponse.json({ error: 'System-generated journal entries cannot be edited manually' }, { status: 400 });
        if (existing.status === 'Posted')
          return NextResponse.json({ error: 'Posted journal entries cannot be edited' }, { status: 400 });

        const body = await readJson(request);

        if (!body.journalDate)
          return NextResponse.json({ error: 'Journal date is required' }, { status: 400 });
        if (!body.description?.trim())
          return NextResponse.json({ error: 'Description is required' }, { status: 400 });

        const lines = body.lines || [];
        if (lines.length < 2)
          return NextResponse.json({ error: 'Minimum 2 journal lines are required' }, { status: 400 });

        for (const line of lines) {
          if (!line.chartOfAccountId)
            return NextResponse.json({ error: 'Each line must have an account selected' }, { status: 400 });
          const debit = Number(line.debitAmount) || 0;
          const credit = Number(line.creditAmount) || 0;
          if (debit > 0 && credit > 0)
            return NextResponse.json({ error: 'A line cannot have both debit and credit values' }, { status: 400 });
          const coa = await prisma.chartOfAccount.findUnique({ where: { id: line.chartOfAccountId } });
          if (!coa || !coa.allowTransaction)
            return NextResponse.json({ error: 'Selected account does not allow transactions' }, { status: 400 });
        }

        const totalDebit = lines.reduce((s, l) => s + (Number(l.debitAmount) || 0), 0);
        const totalCredit = lines.reduce((s, l) => s + (Number(l.creditAmount) || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01)
          return NextResponse.json({ error: 'Total debit must equal total credit' }, { status: 400 });

        await prisma.journalEntryLine.deleteMany({ where: { journalEntryId: segs[1] } });

        const updated = await prisma.journalEntry.update({
          where: { id: segs[1] },
          data: {
            journalDate: body.journalDate,
            description: body.description.trim(),
            referenceNumber: body.referenceNumber?.trim() || '',
            journalSource: body.journalSource || existing.journalSource,
            sourceId: body.sourceId?.trim() || '',
            totalDebit,
            totalCredit,
            createdBy: body.createdBy?.trim() || existing.createdBy,
            lines: {
              create: lines.map((l) => ({
                id: uuid(),
                chartOfAccountId: l.chartOfAccountId,
                description: l.description?.trim() || '',
                debitAmount: Number(l.debitAmount) || 0,
                creditAmount: Number(l.creditAmount) || 0,
              })),
            },
          },
          include: { lines: { include: { chartOfAccount: true } } },
        });
        return NextResponse.json(updated);
      }

      // DELETE /journalentries/:id — Manual Draft only
      if (method === 'DELETE' && segs.length === 2) {
        const existing = await prisma.journalEntry.findUnique({ where: { id: segs[1] } });
        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (existing.journalType === 'System')
          return NextResponse.json({ error: 'System-generated journal entries cannot be deleted manually' }, { status: 400 });
        if (existing.status === 'Posted')
          return NextResponse.json({ error: 'Posted journal entries cannot be deleted' }, { status: 400 });
        await prisma.journalEntry.delete({ where: { id: segs[1] } });
        return NextResponse.json({ ok: true });
      }
    }

    // ---------- GENERAL LEDGER ----------
    if (segs[0] === 'generalledger' && method === 'GET') {
      const url = new URL(request.url);
      const accountId = url.searchParams.get('accountId');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const search = url.searchParams.get('search');

      if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });

      const account = await prisma.chartOfAccount.findUnique({ where: { id: accountId } });
      if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

      // Build journal entry filter
      const journalFilter = { AND: [{ status: 'Posted' }] };
      if (from) journalFilter.AND.push({ journalDate: { gte: from } });
      if (to) journalFilter.AND.push({ journalDate: { lte: to } });
      if (search) {
        journalFilter.AND.push({
          OR: [
            { description: { contains: search, mode: 'insensitive' } },
            { journalNumber: { contains: search, mode: 'insensitive' } },
            { referenceNumber: { contains: search, mode: 'insensitive' } },
          ],
        });
      }

      const journalLines = await prisma.journalEntryLine.findMany({
        where: {
          chartOfAccountId: accountId,
          journalEntry: journalFilter,
        },
        include: {
          journalEntry: {
            select: {
              id: true,
              journalNumber: true,
              journalDate: true,
              journalSource: true,
              journalType: true,
              referenceNumber: true,
              description: true,
            },
          },
        },
        orderBy: [
          { journalEntry: { journalDate: 'asc' } },
          { journalEntry: { journalNumber: 'asc' } },
        ],
      });

      // Calculate running balance
      const normalBalance = account.normalBalance; // 'Debit' or 'Credit'
      const openingBalance = 0;
      let runningBalance = openingBalance;
      let totalDebit = 0;
      let totalCredit = 0;

      const lines = journalLines.map((line) => {
        const debit = line.debitAmount || 0;
        const credit = line.creditAmount || 0;
        totalDebit += debit;
        totalCredit += credit;
        if (normalBalance === 'Debit') {
          runningBalance += debit - credit;
        } else {
          runningBalance += credit - debit;
        }
        return {
          id: line.id,
          journalEntryId: line.journalEntry.id,
          journalNumber: line.journalEntry.journalNumber,
          journalDate: line.journalEntry.journalDate,
          journalSource: line.journalEntry.journalSource,
          journalType: line.journalEntry.journalType,
          referenceNumber: line.journalEntry.referenceNumber,
          description: line.description?.trim() || line.journalEntry.description,
          debitAmount: debit,
          creditAmount: credit,
          runningBalance,
        };
      });

      return NextResponse.json({
        account,
        openingBalance,
        totalDebit,
        totalCredit,
        closingBalance: runningBalance,
        lines,
      });
    }

    // ---------- TRIAL BALANCE ----------
    if (segs[0] === 'trialbalance' && method === 'GET') {
      const url = new URL(request.url);
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');

      const journalFilter = { AND: [{ status: 'Posted' }] };
      if (from) journalFilter.AND.push({ journalDate: { gte: from } });
      if (to) journalFilter.AND.push({ journalDate: { lte: to } });

      const accounts = await prisma.chartOfAccount.findMany({
        where: { isActive: true, allowTransaction: true },
        orderBy: { accountCode: 'asc' },
      });

      const lines = await prisma.journalEntryLine.findMany({
        where: {
          journalEntry: journalFilter,
          chartOfAccountId: { in: accounts.map((a) => a.id) },
        },
        select: {
          chartOfAccountId: true,
          debitAmount: true,
          creditAmount: true,
        },
      });

      const aggMap = {};
      for (const line of lines) {
        if (!aggMap[line.chartOfAccountId]) {
          aggMap[line.chartOfAccountId] = { totalDebit: 0, totalCredit: 0 };
        }
        aggMap[line.chartOfAccountId].totalDebit += line.debitAmount || 0;
        aggMap[line.chartOfAccountId].totalCredit += line.creditAmount || 0;
      }

      const rows = accounts
        .filter((a) => aggMap[a.id])
        .map((a) => ({
          id: a.id,
          accountCode: a.accountCode,
          accountName: a.accountName,
          accountType: a.accountType,
          totalDebit: aggMap[a.id]?.totalDebit || 0,
          totalCredit: aggMap[a.id]?.totalCredit || 0,
        }));

      const totalDebit = rows.reduce((s, r) => s + r.totalDebit, 0);
      const totalCredit = rows.reduce((s, r) => s + r.totalCredit, 0);
      const difference = Math.abs(totalDebit - totalCredit);

      return NextResponse.json({
        rows,
        totalDebit,
        totalCredit,
        difference,
        isBalanced: difference < 0.01,
      });
    }

    // ---------- CASH FLOW STATEMENT ----------
    if (segs[0] === 'cashflow' && method === 'GET') {
      const url = new URL(request.url);
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');

      const txnWhere = {};
      if (from || to) {
        txnWhere.transactionDate = {};
        if (from) txnWhere.transactionDate.gte = from;
        if (to) txnWhere.transactionDate.lte = to;
      }

      const [inTxns, outTxns, financialAccounts, prevTxns] = await Promise.all([
        prisma.cashTransaction.findMany({
          where: { transactionType: 'IN', ...txnWhere },
          include: { chartOfAccount: true, financialAccount: true },
          orderBy: { transactionDate: 'asc' },
        }),
        prisma.cashTransaction.findMany({
          where: { transactionType: 'OUT', ...txnWhere },
          include: { chartOfAccount: true, financialAccount: true },
          orderBy: { transactionDate: 'asc' },
        }),
        prisma.financialAccount.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
        }),
        from
          ? prisma.cashTransaction.findMany({
              where: { transactionDate: { lt: from } },
              select: { financialAccountId: true, transactionType: true, amount: true },
            })
          : Promise.resolve([]),
      ]);

      // Group inflows by COA
      const inflowMap = {};
      for (const txn of inTxns) {
        const key = txn.chartOfAccountId;
        if (!inflowMap[key]) {
          inflowMap[key] = {
            coaId: txn.chartOfAccountId,
            accountCode: txn.chartOfAccount.accountCode,
            accountName: txn.chartOfAccount.accountName,
            count: 0,
            amount: 0,
          };
        }
        inflowMap[key].count++;
        inflowMap[key].amount += txn.amount;
      }

      // Group outflows by COA
      const outflowMap = {};
      for (const txn of outTxns) {
        const key = txn.chartOfAccountId;
        if (!outflowMap[key]) {
          outflowMap[key] = {
            coaId: txn.chartOfAccountId,
            accountCode: txn.chartOfAccount.accountCode,
            accountName: txn.chartOfAccount.accountName,
            count: 0,
            amount: 0,
          };
        }
        outflowMap[key].count++;
        outflowMap[key].amount += txn.amount;
      }

      const inflows = Object.values(inflowMap).sort((a, b) => a.accountCode.localeCompare(b.accountCode));
      const outflows = Object.values(outflowMap).sort((a, b) => a.accountCode.localeCompare(b.accountCode));

      const totalInflows = inflows.reduce((s, r) => s + r.amount, 0);
      const totalOutflows = outflows.reduce((s, r) => s + r.amount, 0);
      const netCashFlow = totalInflows - totalOutflows;

      // Financial Account Summary
      const accountSummary = financialAccounts.map((fa) => {
        const prevIn = prevTxns
          .filter((t) => t.financialAccountId === fa.id && t.transactionType === 'IN')
          .reduce((s, t) => s + t.amount, 0);
        const prevOut = prevTxns
          .filter((t) => t.financialAccountId === fa.id && t.transactionType === 'OUT')
          .reduce((s, t) => s + t.amount, 0);
        const openingBalance = fa.openingBalance + prevIn - prevOut;

        const totalIn = inTxns.filter((t) => t.financialAccountId === fa.id).reduce((s, t) => s + t.amount, 0);
        const totalOut = outTxns.filter((t) => t.financialAccountId === fa.id).reduce((s, t) => s + t.amount, 0);
        const closingBalance = openingBalance + totalIn - totalOut;

        return { id: fa.id, name: fa.name, type: fa.type, openingBalance, totalIn, totalOut, closingBalance };
      });

      const openingCashPosition = accountSummary.reduce((s, a) => s + a.openingBalance, 0);
      const closingCashPosition = accountSummary.reduce((s, a) => s + a.closingBalance, 0);
      const calculatedClosing = openingCashPosition + totalInflows - totalOutflows;
      const validationDiff = Math.abs(calculatedClosing - closingCashPosition);
      const isValid = validationDiff < 0.01;

      return NextResponse.json({
        inflows,
        outflows,
        totalInflows,
        totalOutflows,
        netCashFlow,
        accountSummary,
        openingCashPosition,
        closingCashPosition,
        calculatedClosing,
        isValid,
        validationDiff,
      });
    }

    // ---------- PROFIT & LOSS ----------
    if (segs[0] === 'profitloss' && method === 'GET') {
      const url = new URL(request.url);
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');

      const journalFilter = { AND: [{ status: 'Posted' }] };
      if (from) journalFilter.AND.push({ journalDate: { gte: from } });
      if (to) journalFilter.AND.push({ journalDate: { lte: to } });

      // Get revenue and expense accounts
      const accounts = await prisma.chartOfAccount.findMany({
        where: {
          isActive: true,
          allowTransaction: true,
          accountType: { in: ['Revenue', 'Expense'] },
        },
        orderBy: { accountCode: 'asc' },
      });

      if (!accounts.length) {
        return NextResponse.json({
          revenueRows: [], expenseRows: [],
          totalRevenue: 0, totalExpenses: 0, netProfit: 0,
        });
      }

      const lines = await prisma.journalEntryLine.findMany({
        where: {
          journalEntry: journalFilter,
          chartOfAccountId: { in: accounts.map((a) => a.id) },
        },
        select: { chartOfAccountId: true, debitAmount: true, creditAmount: true },
      });

      const aggMap = {};
      for (const line of lines) {
        if (!aggMap[line.chartOfAccountId]) {
          aggMap[line.chartOfAccountId] = { totalDebit: 0, totalCredit: 0 };
        }
        aggMap[line.chartOfAccountId].totalDebit += line.debitAmount || 0;
        aggMap[line.chartOfAccountId].totalCredit += line.creditAmount || 0;
      }

      const revenueRows = [];
      const expenseRows = [];

      for (const a of accounts) {
        const agg = aggMap[a.id];
        if (!agg) continue;
        // Revenue: normal balance is Credit → net = creditAmount - debitAmount
        // Expense: normal balance is Debit   → net = debitAmount - creditAmount
        const amount = a.accountType === 'Revenue'
          ? agg.totalCredit - agg.totalDebit
          : agg.totalDebit - agg.totalCredit;
        const row = { id: a.id, accountCode: a.accountCode, accountName: a.accountName, accountType: a.accountType, amount };
        if (a.accountType === 'Revenue') revenueRows.push(row);
        else expenseRows.push(row);
      }

      const totalRevenue = revenueRows.reduce((s, r) => s + r.amount, 0);
      const totalExpenses = expenseRows.reduce((s, r) => s + r.amount, 0);

      return NextResponse.json({
        revenueRows,
        expenseRows,
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
      });
    }

    // ---------- BALANCE SHEET ----------
    if (segs[0] === 'balancesheet' && method === 'GET') {
      const url = new URL(request.url);
      const asOf = url.searchParams.get('asOf'); // YYYY-MM-DD

      const journalFilter = { AND: [{ status: 'Posted' }] };
      if (asOf) journalFilter.AND.push({ journalDate: { lte: asOf } });

      // Fetch balance-sheet accounts AND income-statement accounts together
      const accounts = await prisma.chartOfAccount.findMany({
        where: {
          isActive: true,
          allowTransaction: true,
          accountType: { in: ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] },
        },
        orderBy: { accountCode: 'asc' },
      });

      const lines = await prisma.journalEntryLine.findMany({
        where: {
          journalEntry: journalFilter,
          chartOfAccountId: { in: accounts.map((a) => a.id) },
        },
        select: { chartOfAccountId: true, debitAmount: true, creditAmount: true },
      });

      const aggMap = {};
      for (const line of lines) {
        if (!aggMap[line.chartOfAccountId]) {
          aggMap[line.chartOfAccountId] = { totalDebit: 0, totalCredit: 0 };
        }
        aggMap[line.chartOfAccountId].totalDebit += line.debitAmount || 0;
        aggMap[line.chartOfAccountId].totalCredit += line.creditAmount || 0;
      }

      const assetRows = [];
      const liabilityRows = [];
      const equityRows = [];
      let totalRevenue = 0;
      let totalExpenses = 0;

      for (const a of accounts) {
        const agg = aggMap[a.id] || { totalDebit: 0, totalCredit: 0 };
        if (a.accountType === 'Asset') {
          const balance = agg.totalDebit - agg.totalCredit;
          assetRows.push({ id: a.id, accountCode: a.accountCode, accountName: a.accountName, accountType: a.accountType, balance });
        } else if (a.accountType === 'Liability') {
          const balance = agg.totalCredit - agg.totalDebit;
          liabilityRows.push({ id: a.id, accountCode: a.accountCode, accountName: a.accountName, accountType: a.accountType, balance });
        } else if (a.accountType === 'Equity') {
          const balance = agg.totalCredit - agg.totalDebit;
          equityRows.push({ id: a.id, accountCode: a.accountCode, accountName: a.accountName, accountType: a.accountType, balance });
        } else if (a.accountType === 'Revenue') {
          // Revenue: credit - debit
          totalRevenue += agg.totalCredit - agg.totalDebit;
        } else if (a.accountType === 'Expense') {
          // Expense: debit - credit
          totalExpenses += agg.totalDebit - agg.totalCredit;
        }
      }

      const currentYearEarnings = totalRevenue - totalExpenses;
      const totalAssets = assetRows.reduce((s, r) => s + r.balance, 0);
      const totalLiabilities = liabilityRows.reduce((s, r) => s + r.balance, 0);
      const equityBase = equityRows.reduce((s, r) => s + r.balance, 0);
      const totalEquity = equityBase + currentYearEarnings;
      const difference = Math.abs(totalAssets - (totalLiabilities + totalEquity));

      return NextResponse.json({
        assetRows, liabilityRows, equityRows,
        totalAssets, totalLiabilities, totalEquity,
        currentYearEarnings,
        isBalanced: difference < 0.01,
        difference,
      });
    }

    // ---------- PRODUCTS — special POST: auto-create inventory rows ----------
    if (segs[0] === 'products' && method === 'POST' && segs.length === 1) {
      const body = await readJson(request);
      const productId = uuid();
      const colors = Array.isArray(body.colors) ? body.colors : [];
      const sizes = Array.isArray(body.sizes) ? body.sizes : [];

      const inventoryRecords = [];
      for (const color of colors) {
        for (const size of sizes) {
          inventoryRecords.push({
            id: uuid(),
            productId,
            color,
            size,
            quantity: 0,
            threshold: 5,
            incoming: 0,
          });
        }
      }

      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({ data: { id: productId, ...body } });
        if (inventoryRecords.length > 0) {
          await tx.inventory.createMany({ data: inventoryRecords });
        }
        return created;
      });

      return NextResponse.json(product);
    }

    // ---------- PRODUCTS — repair-inventory: create missing rows for all products ----------
    if (segs[0] === 'products' && segs[1] === 'repair-inventory' && method === 'POST') {
      const products = await prisma.product.findMany();
      const existingInv = await prisma.inventory.findMany({
        select: { productId: true, color: true, size: true },
      });

      const existingSet = new Set(existingInv.map((i) => `${i.productId}::${i.color}::${i.size}`));
      const toCreate = [];

      for (const p of products) {
        const colors = Array.isArray(p.colors) ? p.colors : [];
        const sizes = Array.isArray(p.sizes) ? p.sizes : [];
        for (const color of colors) {
          for (const size of sizes) {
            if (!existingSet.has(`${p.id}::${color}::${size}`)) {
              toCreate.push({
                id: uuid(),
                productId: p.id,
                color,
                size,
                quantity: 0,
                threshold: 5,
                incoming: 0,
              });
            }
          }
        }
      }

      if (toCreate.length > 0) {
        await prisma.inventory.createMany({ data: toCreate });
      }

      return NextResponse.json({ created: toCreate.length, repaired: products.length });
    }

    // ---------- INVENTORY PUT — intercept to auto-create StockMovement ----------
    if (segs[0] === 'inventory' && method === 'PUT' && segs.length === 2) {
      const id = segs[1];
      const body = await readJson(request);
      const current = await prisma.inventory.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });

      const prevQty = current.quantity;
      const newQty = body.quantity !== undefined ? Number(body.quantity) : prevQty;
      const updated = await prisma.inventory.update({ where: { id }, data: body });

      if (newQty !== prevQty) {
        const delta = newQty - prevQty;
        const movementType = delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
        const today = new Date().toISOString().split('T')[0];
        const ref = await generateStockMovementRef(today);
        await prisma.stockMovement.create({
          data: {
            id: uuid(),
            itemType: 'PRODUCT',
            inventoryId: id,
            productId: current.productId,
            movementDate: today,
            movementType,
            quantity: Math.abs(delta),
            previousQuantity: prevQty,
            newQuantity: newQty,
            notes: 'Auto-recorded from inventory adjustment',
            referenceNumber: ref,
          },
        });
      }
      return NextResponse.json(updated);
    }

    // ---------- STOCK MOVEMENTS ----------
    if (segs[0] === 'stockmovements') {
      // Stats
      if (segs[1] === 'stats' && method === 'GET') {
        const url = new URL(request.url);
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const type = url.searchParams.get('type');
        const itemType = url.searchParams.get('itemType');
        const where = {};
        if (from || to) { where.movementDate = {}; if (from) where.movementDate.gte = from; if (to) where.movementDate.lte = to; }
        if (type) where.movementType = type;
        if (itemType && itemType !== 'all') where.itemType = itemType;
        const movements = await prisma.stockMovement.findMany({ where, select: { movementType: true, quantity: true, itemType: true } });
        const totalMovements = movements.length;
        const inTypes = ['ADJUSTMENT_IN', 'MANUAL_IN', 'OPENING'];
        const outTypes = ['ADJUSTMENT_OUT', 'MANUAL_OUT'];
        const totalIn = movements.filter(m => inTypes.includes(m.movementType)).reduce((s, m) => s + m.quantity, 0);
        const totalOut = movements.filter(m => outTypes.includes(m.movementType)).reduce((s, m) => s + m.quantity, 0);
        const productMovements = movements.filter(m => (m.itemType || 'PRODUCT') === 'PRODUCT').length;
        const rawMaterialMovements = movements.filter(m => m.itemType === 'RAW_MATERIAL').length;
        return NextResponse.json({ totalMovements, totalIn, totalOut, productMovements, rawMaterialMovements });
      }

      // List
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const type = url.searchParams.get('type');
        const search = url.searchParams.get('search');
        const itemType = url.searchParams.get('itemType');
        const where = {};
        if (from || to) { where.movementDate = {}; if (from) where.movementDate.gte = from; if (to) where.movementDate.lte = to; }
        if (type) where.movementType = type;
        if (itemType && itemType !== 'all') where.itemType = itemType;
        const movements = await prisma.stockMovement.findMany({
          where,
          include: {
            product: { select: { id: true, name: true, sku: true } },
            inventory: { select: { color: true, size: true } },
            rawMaterial: { select: { id: true, name: true, category: true, unit: true } },
          },
          orderBy: [{ movementDate: 'desc' }, { createdAt: 'desc' }],
        });
        const result = search
          ? movements.filter(m => {
              const s = search.toLowerCase();
              return (m.product?.name || '').toLowerCase().includes(s)
                || (m.product?.sku || '').toLowerCase().includes(s)
                || (m.rawMaterial?.name || '').toLowerCase().includes(s)
                || (m.referenceNumber || '').toLowerCase().includes(s);
            })
          : movements;
        return NextResponse.json(result);
      }

      // Manual adjustment POST
      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        if (!body.movementType) return NextResponse.json({ error: 'movementType is required' }, { status: 400 });
        const qty = Number(body.quantity);
        if (!qty || qty <= 0) return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 });

        const inTypes = ['MANUAL_IN', 'OPENING', 'ADJUSTMENT_IN'];
        const outTypes = ['MANUAL_OUT', 'ADJUSTMENT_OUT'];
        const movementDate = body.movementDate || new Date().toISOString().split('T')[0];
        const ref = body.referenceNumber || await generateStockMovementRef(movementDate);

        // ---------- RAW MATERIAL path ----------
        if (body.rawMaterialId && !body.inventoryId) {
          const rm = await prisma.rawMaterial.findUnique({ where: { id: body.rawMaterialId } });
          if (!rm) return NextResponse.json({ error: 'Raw material not found' }, { status: 404 });

          const prevQty = rm.currentStock || 0;
          let newQty;
          if (inTypes.includes(body.movementType)) {
            newQty = prevQty + qty;
          } else if (outTypes.includes(body.movementType)) {
            newQty = prevQty - qty;
            if (newQty < 0) return NextResponse.json({ error: `Insufficient stock. Current: ${prevQty}, Requested: ${qty}` }, { status: 400 });
          } else {
            return NextResponse.json({ error: 'Invalid movementType' }, { status: 400 });
          }

          const [movement] = await prisma.$transaction([
            prisma.stockMovement.create({
              data: {
                id: uuid(),
                itemType: 'RAW_MATERIAL',
                rawMaterialId: body.rawMaterialId,
                movementDate,
                movementType: body.movementType,
                quantity: qty,
                previousQuantity: prevQty,
                newQuantity: newQty,
                notes: body.notes || '',
                referenceNumber: ref,
              },
            }),
            prisma.rawMaterial.update({ where: { id: body.rawMaterialId }, data: { currentStock: newQty } }),
          ]);
          return NextResponse.json(movement);
        }

        // ---------- PRODUCT INVENTORY path ----------
        if (!body.inventoryId) return NextResponse.json({ error: 'inventoryId is required for product movements' }, { status: 400 });

        const inv = await prisma.inventory.findUnique({ where: { id: body.inventoryId } });
        if (!inv) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });

        const prevQty = inv.quantity;
        let newQty;
        if (inTypes.includes(body.movementType)) {
          newQty = prevQty + qty;
        } else if (outTypes.includes(body.movementType)) {
          newQty = prevQty - qty;
          if (newQty < 0) return NextResponse.json({ error: `Insufficient stock. Current: ${prevQty}, Requested: ${qty}` }, { status: 400 });
        } else {
          return NextResponse.json({ error: 'Invalid movementType' }, { status: 400 });
        }

        const [movement] = await prisma.$transaction([
          prisma.stockMovement.create({
            data: {
              id: uuid(),
              itemType: 'PRODUCT',
              inventoryId: body.inventoryId,
              productId: inv.productId,
              movementDate,
              movementType: body.movementType,
              quantity: qty,
              previousQuantity: prevQty,
              newQuantity: newQty,
              notes: body.notes || '',
              referenceNumber: ref,
            },
          }),
          prisma.inventory.update({ where: { id: body.inventoryId }, data: { quantity: newQty } }),
        ]);
        return NextResponse.json(movement);
      }
    }

    // ---------- RAW MATERIALS PUT — update master data only, no Stock Movement ----------
    // Raw Materials is master data. Creating or updating a Raw Material must NOT generate
    // any Stock Movement record. Stock Movements for raw materials are only created via
    // explicit manual adjustments through the /stockmovements endpoint.
    if (segs[0] === 'rawmaterials' && method === 'PUT' && segs.length === 2) {
      const id = segs[1];
      const body = await readJson(request);
      const current = await prisma.rawMaterial.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: 'Raw material not found' }, { status: 404 });
      const updated = await prisma.rawMaterial.update({ where: { id }, data: body });
      return NextResponse.json(updated);
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

    // ─────────── BOM ───────────
    if (segs[0] === 'bom') {
      // Stats
      if (segs[1] === 'stats' && method === 'GET') {
        const all = await prisma.bOM.findMany({ select: { status: true } });
        const total = all.length;
        const active = all.filter(b => b.status === 'Active').length;
        const inactive = all.filter(b => b.status === 'Inactive').length;
        return NextResponse.json({ total, active, inactive });
      }

      // List
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const search = url.searchParams.get('search');
        const status = url.searchParams.get('status');
        const where = {};
        if (status && status !== 'all') where.status = status;
        const boms = await prisma.bOM.findMany({
          where,
          include: {
            product: { select: { id: true, name: true, sku: true } },
            _count: { select: { items: true } },
          },
          orderBy: { bomCode: 'asc' },
        });
        const result = search
          ? boms.filter(b => {
              const q = search.toLowerCase();
              return b.bomCode.toLowerCase().includes(q)
                || b.product.name.toLowerCase().includes(q)
                || b.version.toLowerCase().includes(q);
            })
          : boms;
        return NextResponse.json(result);
      }

      // Get by ID (with items)
      if (method === 'GET' && segs.length === 2) {
        const bom = await prisma.bOM.findUnique({
          where: { id: segs[1] },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            items: {
              include: { rawMaterial: { select: { id: true, name: true, unit: true, category: true } } },
              orderBy: { id: 'asc' },
            },
          },
        });
        if (!bom) return NextResponse.json({ error: 'BOM not found' }, { status: 404 });
        return NextResponse.json(bom);
      }

      // Create
      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        if (!body.productId) return NextResponse.json({ error: 'Product is required' }, { status: 400 });
        if (!Array.isArray(body.items) || body.items.length === 0)
          return NextResponse.json({ error: 'At least one material is required' }, { status: 400 });
        for (const it of body.items) {
          if (!it.rawMaterialId) return NextResponse.json({ error: 'Raw material is required for each item' }, { status: 400 });
          if (!it.quantityRequired || Number(it.quantityRequired) <= 0)
            return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 });
        }
        // Enforce one Active BOM per product
        if ((body.status || 'Active') === 'Active') {
          const existingActive = await prisma.bOM.findFirst({ where: { productId: body.productId, status: 'Active' } });
          if (existingActive) return NextResponse.json({ error: 'This product already has an Active BOM. Deactivate it first.' }, { status: 400 });
        }
        const bomCode = await generateBomCode();
        const bom = await prisma.bOM.create({
          data: {
            id: uuid(),
            bomCode,
            productId: body.productId,
            version: body.version || '1.0',
            description: body.description || '',
            status: body.status || 'Active',
            items: {
              create: body.items.map(it => ({
                id: uuid(),
                rawMaterialId: it.rawMaterialId,
                quantityRequired: Number(it.quantityRequired),
                notes: it.notes || '',
              })),
            },
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            items: { include: { rawMaterial: { select: { id: true, name: true, unit: true } } } },
          },
        });
        return NextResponse.json(bom);
      }

      // Update
      if (method === 'PUT' && segs.length === 2) {
        const body = await readJson(request);
        // Enforce one Active BOM per product
        if (body.status === 'Active' && body.productId) {
          const existingActive = await prisma.bOM.findFirst({
            where: { productId: body.productId, status: 'Active', id: { not: segs[1] } },
          });
          if (existingActive) return NextResponse.json({ error: 'This product already has an Active BOM. Deactivate it first.' }, { status: 400 });
        }
        const { id: _id, bomCode: _code, createdAt: _ca, updatedAt: _ua, items, product: _p, _count: _cnt, ...rest } = body;
        // Replace items if provided
        const bom = await prisma.bOM.update({
          where: { id: segs[1] },
          data: {
            ...rest,
            ...(items !== undefined
              ? {
                  items: {
                    deleteMany: {},
                    create: items.map(it => ({
                      id: uuid(),
                      rawMaterialId: it.rawMaterialId,
                      quantityRequired: Number(it.quantityRequired),
                      notes: it.notes || '',
                    })),
                  },
                }
              : {}),
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            items: { include: { rawMaterial: { select: { id: true, name: true, unit: true } } } },
          },
        });
        return NextResponse.json(bom);
      }

      // Soft-delete: set status Inactive (no physical delete)
      if (method === 'DELETE' && segs.length === 2) {
        const updated = await prisma.bOM.update({ where: { id: segs[1] }, data: { status: 'Inactive' } });
        return NextResponse.json(updated);
      }
    }

    // ─────────── PRODUCTION ORDERS ───────────
    if (segs[0] === 'productionorders') {
      // Stats
      if (segs[1] === 'stats' && method === 'GET') {
        const all = await prisma.productionOrder.findMany({ select: { status: true } });
        const total = all.length;
        const draft = all.filter(p => p.status === 'Draft').length;
        const ready = all.filter(p => p.status === 'Ready').length;
        const notReady = all.filter(p => p.status === 'Not Ready').length;
        const inProduction = all.filter(p => p.status === 'In Production').length;
        const completed = all.filter(p => p.status === 'Completed').length;
        const cancelled = all.filter(p => p.status === 'Cancelled').length;
        return NextResponse.json({ total, draft, ready, notReady, inProduction, completed, cancelled });
      }

      // List
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const search = url.searchParams.get('search');
        const status = url.searchParams.get('status');
        const where = {};
        if (status && status !== 'all') where.status = status;
        const orders = await prisma.productionOrder.findMany({
          where,
          include: {
            product: { select: { id: true, name: true, sku: true } },
            bom: { select: { id: true, bomCode: true, version: true } },
          },
          orderBy: { productionOrderNumber: 'desc' },
        });
        const result = search
          ? orders.filter(o => {
              const q = search.toLowerCase();
              return o.productionOrderNumber.toLowerCase().includes(q)
                || o.product.name.toLowerCase().includes(q);
            })
          : orders;
        return NextResponse.json(result);
      }

      // Get by ID (with material requirements)
      if (method === 'GET' && segs.length === 2) {
        const order = await prisma.productionOrder.findUnique({
          where: { id: segs[1] },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            bom: {
              include: {
                items: {
                  include: { rawMaterial: { select: { id: true, name: true, unit: true, currentStock: true } } },
                },
              },
            },
          },
        });
        if (!order) return NextResponse.json({ error: 'Production Order not found' }, { status: 404 });
        // Calculate material requirements
        const requirements = order.bom.items.map(it => {
          const required = it.quantityRequired * order.plannedQuantity;
          const stock = it.rawMaterial.currentStock ?? 0;
          const shortage = Math.max(0, required - stock);
          return {
            rawMaterialId: it.rawMaterialId,
            rawMaterial: it.rawMaterial,
            quantityPerUnit: it.quantityRequired,
            requiredQuantity: required,
            currentStock: stock,
            shortage,
            status: shortage <= 0 ? 'Sufficient' : 'Shortage',
            notes: it.notes,
          };
        });
        const isReady = requirements.every(r => r.shortage <= 0);
        return NextResponse.json({ ...order, requirements, isReady });
      }

      // Get active BOM for a product (helper)
      if (segs[1] === 'active-bom' && method === 'GET') {
        const url = new URL(request.url);
        const productId = url.searchParams.get('productId');
        if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
        const bom = await prisma.bOM.findFirst({
          where: { productId, status: 'Active' },
          include: {
            items: {
              include: { rawMaterial: { select: { id: true, name: true, unit: true, currentStock: true } } },
            },
          },
        });
        return NextResponse.json(bom ?? null);
      }

      // Create
      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        if (!body.productId) return NextResponse.json({ error: 'Product is required' }, { status: 400 });
        if (!body.plannedQuantity || Number(body.plannedQuantity) <= 0)
          return NextResponse.json({ error: 'Planned quantity must be greater than zero' }, { status: 400 });
        if (!body.plannedDate) return NextResponse.json({ error: 'Planned date is required' }, { status: 400 });
        // Get active BOM
        const activeBom = await prisma.bOM.findFirst({
          where: { productId: body.productId, status: 'Active' },
          include: { items: { include: { rawMaterial: { select: { currentStock: true } } } } },
        });
        if (!activeBom) return NextResponse.json({ error: 'No Active BOM found for this product. Create and activate a BOM first.' }, { status: 400 });
        // Determine readiness
        const qty = Number(body.plannedQuantity);
        const isReady = activeBom.items.every(it => (it.rawMaterial.currentStock ?? 0) >= it.quantityRequired * qty);
        const autoStatus = body.status && body.status !== 'Draft' ? body.status : (isReady ? 'Ready' : 'Not Ready');
        // Generate PO number
        const existing = await prisma.productionOrder.findMany({ select: { productionOrderNumber: true }, orderBy: { productionOrderNumber: 'desc' } });
        let maxSeq = 0;
        for (const e of existing) {
          const parts = e.productionOrderNumber.split('-');
          const seq = parseInt(parts[parts.length - 1] || '0', 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
        const productionOrderNumber = `PO-${String(maxSeq + 1).padStart(4, '0')}`;
        const order = await prisma.productionOrder.create({
          data: {
            id: uuid(),
            productionOrderNumber,
            productId: body.productId,
            bomId: activeBom.id,
            plannedQuantity: qty,
            plannedDate: body.plannedDate,
            status: autoStatus,
            notes: body.notes || '',
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            bom: { select: { id: true, bomCode: true, version: true } },
          },
        });
        return NextResponse.json(order);
      }

      // ── Start Production (POST /productionorders/:id/start)
      if (method === 'POST' && segs.length === 3 && segs[2] === 'start') {
        const order = await prisma.productionOrder.findUnique({ where: { id: segs[1] } });
        if (!order) return NextResponse.json({ error: 'Production Order not found' }, { status: 404 });
        if (order.status !== 'Ready') return NextResponse.json({ error: `Cannot start — current status is "${order.status}". Only Ready orders can be started.` }, { status: 400 });
        const updated = await prisma.productionOrder.update({
          where: { id: segs[1] },
          data: { status: 'In Production', startedAt: new Date() },
          include: { product: { select: { id: true, name: true, sku: true } }, bom: { select: { id: true, bomCode: true, version: true } } },
        });
        return NextResponse.json(updated);
      }

      // ── Complete Production (POST /productionorders/:id/complete)
      if (method === 'POST' && segs.length === 3 && segs[2] === 'complete') {
        const body = await readJson(request);
        const actualQty = Number(body.actualQuantity);
        if (!actualQty || actualQty <= 0) return NextResponse.json({ error: 'Actual quantity must be greater than zero' }, { status: 400 });
        const order = await prisma.productionOrder.findUnique({
          where: { id: segs[1] },
          include: {
            bom: { include: { items: { include: { rawMaterial: true } } } },
          },
        });
        if (!order) return NextResponse.json({ error: 'Production Order not found' }, { status: 404 });
        if (order.status !== 'In Production') return NextResponse.json({ error: `Cannot complete — current status is "${order.status}". Order must be In Production.` }, { status: 400 });

        // Validate stock sufficiency using actual quantity
        for (const it of order.bom.items) {
          const needed = it.quantityRequired * actualQty;
          if ((it.rawMaterial.currentStock ?? 0) < needed) {
            return NextResponse.json({ error: `Insufficient stock for "${it.rawMaterial.name}". Need ${needed}, have ${it.rawMaterial.currentStock ?? 0}.` }, { status: 400 });
          }
        }

        const now = new Date();
        const movDate = now.toISOString().split('T')[0];

        // Execute all stock changes + movements in a transaction
        await prisma.$transaction(async (tx) => {
          // 1. Consume raw materials
          for (const it of order.bom.items) {
            const consumed = it.quantityRequired * actualQty;
            const prev = it.rawMaterial.currentStock ?? 0;
            const next = prev - consumed;
            await tx.rawMaterial.update({ where: { id: it.rawMaterialId }, data: { currentStock: next } });
            await tx.stockMovement.create({
              data: {
                id: uuid(),
                itemType: 'RAW_MATERIAL',
                rawMaterialId: it.rawMaterialId,
                movementDate: movDate,
                movementType: 'PRODUCTION_OUT',
                quantity: consumed,
                previousQuantity: prev,
                newQuantity: next,
                referenceNumber: order.productionOrderNumber,
                notes: body.completionNotes || `Production: ${order.productionOrderNumber}`,
              },
            });
          }

          // 2. Increase product inventory (use first inventory entry or create one)
          const inventoryEntries = await tx.inventory.findMany({ where: { productId: order.productId }, orderBy: { id: 'asc' } });
          let inv;
          if (inventoryEntries.length > 0) {
            inv = inventoryEntries[0];
            await tx.inventory.update({ where: { id: inv.id }, data: { quantity: inv.quantity + actualQty } });
          } else {
            const product = await tx.product.findUnique({ where: { id: order.productId } });
            inv = await tx.inventory.create({
              data: {
                id: uuid(),
                productId: order.productId,
                color: (product?.colors?.[0]) || 'Default',
                size: (product?.sizes?.[0]) || 'Default',
                quantity: actualQty,
                threshold: 0,
                incoming: 0,
              },
            });
          }
          const prevInv = inventoryEntries.length > 0 ? inventoryEntries[0].quantity : 0;
          await tx.stockMovement.create({
            data: {
              id: uuid(),
              itemType: 'PRODUCT',
              productId: order.productId,
              inventoryId: inv.id,
              movementDate: movDate,
              movementType: 'PRODUCTION_IN',
              quantity: actualQty,
              previousQuantity: prevInv,
              newQuantity: prevInv + actualQty,
              referenceNumber: order.productionOrderNumber,
              notes: body.completionNotes || `Production: ${order.productionOrderNumber}`,
            },
          });

          // 3. Update Production Order
          await tx.productionOrder.update({
            where: { id: segs[1] },
            data: {
              status: 'Completed',
              actualQuantity: actualQty,
              completedAt: now,
              notes: body.completionNotes ? (order.notes ? order.notes + '\n' + body.completionNotes : body.completionNotes) : order.notes,
            },
          });

          // 4. Auto-create Production Result (immutable audit record)
          const latestPR = await tx.productionResult.findMany({
            select: { resultNumber: true },
            orderBy: { resultNumber: 'desc' },
            take: 1,
          });
          let maxPR = 0;
          if (latestPR.length > 0) {
            const parts = latestPR[0].resultNumber.split('-');
            const num = parseInt(parts[1], 10);
            if (!isNaN(num)) maxPR = num;
          }
          const resultNumber = `PR-${String(maxPR + 1).padStart(4, '0')}`;
          await tx.productionResult.create({
            data: { id: uuid(), resultNumber, productionOrderId: segs[1] },
          });
        });

        const result = await prisma.productionOrder.findUnique({
          where: { id: segs[1] },
          include: { product: { select: { id: true, name: true, sku: true } }, bom: { select: { id: true, bomCode: true, version: true } } },
        });
        return NextResponse.json(result);
      }

      // Update (status/notes/plannedDate/plannedQuantity only — blocked for Completed)
      if (method === 'PUT' && segs.length === 2) {
        const current = await prisma.productionOrder.findUnique({ where: { id: segs[1] }, select: { status: true } });
        if (current?.status === 'Completed') return NextResponse.json({ error: 'Completed Production Orders cannot be edited.' }, { status: 400 });
        const body = await readJson(request);
        const { id: _id, productionOrderNumber: _n, productId: _p, bomId: _b, createdAt: _ca, updatedAt: _ua, product: _pr, bom: _bm, requirements: _r, isReady: _ir, startedAt: _sa, completedAt: _ca2, actualQuantity: _aq, ...rest } = body;
        const updated = await prisma.productionOrder.update({
          where: { id: segs[1] },
          data: rest,
          include: {
            product: { select: { id: true, name: true, sku: true } },
            bom: { select: { id: true, bomCode: true, version: true } },
          },
        });
        return NextResponse.json(updated);
      }

      // Cancel (soft status change — blocked for Completed)
      if (method === 'DELETE' && segs.length === 2) {
        const current = await prisma.productionOrder.findUnique({ where: { id: segs[1] }, select: { status: true } });
        if (current?.status === 'Completed') return NextResponse.json({ error: 'Completed Production Orders cannot be cancelled.' }, { status: 400 });
        const updated = await prisma.productionOrder.update({ where: { id: segs[1] }, data: { status: 'Cancelled' } });
        return NextResponse.json(updated);
      }
    }

    // ─────────── PRODUCTION RESULTS ───────────
    if (segs[0] === 'productionresults') {
      // List (GET /productionresults)
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const q = url.searchParams.get('search')?.toLowerCase().trim();
        const results = await prisma.productionResult.findMany({
          include: {
            productionOrder: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
                bom: { select: { id: true, bomCode: true, version: true } },
              },
            },
          },
          orderBy: { resultNumber: 'desc' },
        });
        const filtered = q
          ? results.filter((r) =>
              r.resultNumber.toLowerCase().includes(q) ||
              r.productionOrder?.productionOrderNumber?.toLowerCase().includes(q) ||
              r.productionOrder?.product?.name?.toLowerCase().includes(q)
            )
          : results;
        return NextResponse.json(filtered);
      }

      // Detail (GET /productionresults/:id)
      if (method === 'GET' && segs.length === 2) {
        const result = await prisma.productionResult.findUnique({
          where: { id: segs[1] },
          include: {
            productionOrder: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
                bom: {
                  include: {
                    items: {
                      include: { rawMaterial: { select: { id: true, name: true, unit: true } } },
                    },
                  },
                },
              },
            },
          },
        });
        if (!result) return NextResponse.json({ error: 'Production Result not found' }, { status: 404 });

        const movements = await prisma.stockMovement.findMany({
          where: {
            referenceNumber: result.productionOrder.productionOrderNumber,
            movementType: { in: ['PRODUCTION_IN', 'PRODUCTION_OUT'] },
          },
          include: {
            rawMaterial: { select: { id: true, name: true, unit: true } },
            product: { select: { id: true, name: true } },
            inventory: { select: { id: true, color: true, size: true } },
          },
          orderBy: { createdAt: 'asc' },
        });

        return NextResponse.json({ ...result, stockMovements: movements });
      }
    }


    // ─────────── SALES CHANNELS ───────────
    if (segs[0] === 'saleschannels') {
      // Generate channel code: SC-0001
      async function generateChannelCode() {
        const existing = await prisma.salesChannel.findMany({
          select: { channelCode: true },
          orderBy: { channelCode: 'desc' },
        });
        let maxSeq = 0;
        for (const c of existing) {
          const parts = c.channelCode.split('-');
          const seq = parseInt(parts[parts.length - 1] || '0', 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
        return `SC-${String(maxSeq + 1).padStart(4, '0')}`;
      }

      // Stats
      if (segs[1] === 'stats' && method === 'GET') {
        const all = await prisma.salesChannel.findMany({ select: { status: true } });
        const total = all.length;
        const active = all.filter(c => c.status === 'Active').length;
        const inactive = all.filter(c => c.status === 'Inactive').length;
        return NextResponse.json({ total, active, inactive });
      }

      // Seed if empty
      if (segs[1] === 'seed' && method === 'POST') {
        const count = await prisma.salesChannel.count();
        if (count > 0) return NextResponse.json({ seeded: false, message: 'Already has data' });
        const defaults = [
          { channelName: 'Website', channelType: 'Ecommerce', description: 'Official ONEMISSION website store', status: 'Active', isDefault: true },
          { channelName: 'Shopee', channelType: 'Marketplace', description: 'Shopee marketplace channel', status: 'Active', isDefault: false },
          { channelName: 'Tokopedia', channelType: 'Marketplace', description: 'Tokopedia marketplace channel', status: 'Active', isDefault: false },
          { channelName: 'TikTok Shop', channelType: 'Marketplace', description: 'TikTok Shop channel', status: 'Active', isDefault: false },
          { channelName: 'Offline Store', channelType: 'Offline Store', description: 'Physical offline retail store', status: 'Active', isDefault: false },
          { channelName: 'Reseller', channelType: 'Reseller', description: 'Reseller network channel', status: 'Active', isDefault: false },
          { channelName: 'School Partnership', channelType: 'Partnership', description: 'Sales through school partnership programs', status: 'Active', isDefault: false },
        ];
        let seq = 0;
        for (const d of defaults) {
          seq++;
          const code = `SC-${String(seq).padStart(4, '0')}`;
          await prisma.salesChannel.create({ data: { id: uuid(), channelCode: code, ...d } });
        }
        return NextResponse.json({ seeded: true, count: defaults.length });
      }

      // List
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const search = url.searchParams.get('search');
        const status = url.searchParams.get('status');
        const channelType = url.searchParams.get('channelType');
        const where = {};
        if (status && status !== 'all') where.status = status;
        if (channelType && channelType !== 'all') where.channelType = channelType;
        const channels = await prisma.salesChannel.findMany({
          where,
          orderBy: { channelCode: 'asc' },
        });
        const result = search
          ? channels.filter(c => {
              const q = search.toLowerCase();
              return c.channelCode.toLowerCase().includes(q)
                || c.channelName.toLowerCase().includes(q)
                || c.channelType.toLowerCase().includes(q);
            })
          : channels;
        return NextResponse.json(result);
      }

      // Get by ID
      if (method === 'GET' && segs.length === 2) {
        const channel = await prisma.salesChannel.findUnique({ where: { id: segs[1] } });
        if (!channel) return NextResponse.json({ error: 'Sales channel not found' }, { status: 404 });
        return NextResponse.json(channel);
      }

      // Create
      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        if (!body.channelName?.trim()) return NextResponse.json({ error: 'Channel name is required' }, { status: 400 });
        if (!body.channelType?.trim()) return NextResponse.json({ error: 'Channel type is required' }, { status: 400 });
        if (body.isDefault) {
          await prisma.salesChannel.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
        }
        const channelCode = await generateChannelCode();
        const channel = await prisma.salesChannel.create({
          data: {
            id: uuid(),
            channelCode,
            channelName: body.channelName.trim(),
            channelType: body.channelType.trim(),
            description: body.description || '',
            status: body.status || 'Active',
            isDefault: body.isDefault || false,
          },
        });
        return NextResponse.json(channel);
      }

      // Update
      if (method === 'PUT' && segs.length === 2) {
        const body = await readJson(request);
        if (body.channelName !== undefined && !body.channelName?.trim())
          return NextResponse.json({ error: 'Channel name is required' }, { status: 400 });
        if (body.channelType !== undefined && !body.channelType?.trim())
          return NextResponse.json({ error: 'Channel type is required' }, { status: 400 });
        if (body.isDefault) {
          await prisma.salesChannel.updateMany({ where: { isDefault: true, id: { not: segs[1] } }, data: { isDefault: false } });
        }
        const { id: _id, channelCode: _code, createdAt: _ca, updatedAt: _ua, ...rest } = body;
        const updated = await prisma.salesChannel.update({ where: { id: segs[1] }, data: rest });
        return NextResponse.json(updated);
      }

      // Soft delete (set Inactive)
      if (method === 'DELETE' && segs.length === 2) {
        const updated = await prisma.salesChannel.update({ where: { id: segs[1] }, data: { status: 'Inactive' } });
        return NextResponse.json(updated);
      }
    }


    // ─────────── CUSTOMERS ───────────
    if (segs[0] === 'customers') {
      // Generate customer code: CUS-0001
      async function generateCustomerCode() {
        const existing = await prisma.customer.findMany({
          select: { customerCode: true },
          orderBy: { customerCode: 'desc' },
        });
        let maxSeq = 0;
        for (const c of existing) {
          const m = c.customerCode.match(/CUS-(\d+)/);
          if (m) { const n = parseInt(m[1], 10); if (n > maxSeq) maxSeq = n; }
        }
        return `CUS-${String(maxSeq + 1).padStart(4, '0')}`;
      }

      // Stats: total, active, inactive
      if (segs[1] === 'stats' && method === 'GET') {
        const all = await prisma.customer.findMany({ select: { status: true } });
        const total = all.length;
        const active = all.filter(c => c.status === 'Active').length;
        const inactive = all.filter(c => c.status === 'Inactive').length;
        return NextResponse.json({ total, active, inactive });
      }

      // List customers
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const search = url.searchParams.get('search');
        const status = url.searchParams.get('status');
        const customerType = url.searchParams.get('customerType');

        const where = {};
        if (status && status !== 'all') where.status = status;
        if (customerType && customerType !== 'all') where.customerType = customerType;

        let customers = await prisma.customer.findMany({
          where,
          include: { preferredSalesChannel: { select: { id: true, channelName: true, channelCode: true } } },
          orderBy: { customerCode: 'asc' },
        });

        if (search) {
          const q = search.toLowerCase();
          customers = customers.filter(c =>
            c.customerCode.toLowerCase().includes(q) ||
            c.customerName.toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q)
          );
        }
        return NextResponse.json(customers);
      }

      // Get by ID
      if (method === 'GET' && segs.length === 2) {
        const customer = await prisma.customer.findUnique({
          where: { id: segs[1] },
          include: { preferredSalesChannel: { select: { id: true, channelName: true, channelCode: true } } },
        });
        if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        return NextResponse.json(customer);
      }

      // Find by email
      if (segs[1] === 'find-by-email' && method === 'GET') {
        const url = new URL(request.url);
        const email = url.searchParams.get('email');
        if (!email) return NextResponse.json({ error: 'email param required' }, { status: 400 });
        const customer = await prisma.customer.findUnique({ where: { email } });
        return NextResponse.json(customer || null);
      }

      // Find by phone
      if (segs[1] === 'find-by-phone' && method === 'GET') {
        const url = new URL(request.url);
        const phone = url.searchParams.get('phone');
        if (!phone) return NextResponse.json({ error: 'phone param required' }, { status: 400 });
        const customer = await prisma.customer.findUnique({ where: { phone } });
        return NextResponse.json(customer || null);
      }

      // Find or create by email/phone (identity matching for future integrations)
      if (segs[1] === 'find-or-create' && method === 'POST') {
        const body = await readJson(request);
        let customer = null;
        if (body.email) customer = await prisma.customer.findUnique({ where: { email: body.email } });
        if (!customer && body.phone) customer = await prisma.customer.findUnique({ where: { phone: body.phone } });
        if (!customer) {
          if (!body.email && !body.phone)
            return NextResponse.json({ error: 'At least one of email or phone is required' }, { status: 400 });
          const customerCode = await generateCustomerCode();
          customer = await prisma.customer.create({
            data: {
              id: uuid(),
              customerCode,
              customerName: body.customerName || 'Unknown',
              email: body.email || null,
              phone: body.phone || null,
              customerType: body.customerType || 'Individual',
              status: 'Active',
            },
          });
        }
        return NextResponse.json(customer);
      }

      // Create customer
      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        if (!body.customerName?.trim())
          return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
        if (!body.email && !body.phone)
          return NextResponse.json({ error: 'At least one of Email or Phone is required' }, { status: 400 });

        // Uniqueness checks
        if (body.email) {
          const existing = await prisma.customer.findUnique({ where: { email: body.email.trim() } });
          if (existing) return NextResponse.json({ error: `Email ${body.email} is already used by ${existing.customerName} (${existing.customerCode})` }, { status: 409 });
        }
        if (body.phone) {
          const existing = await prisma.customer.findUnique({ where: { phone: body.phone.trim() } });
          if (existing) return NextResponse.json({ error: `Phone ${body.phone} is already used by ${existing.customerName} (${existing.customerCode})` }, { status: 409 });
        }

        const customerCode = await generateCustomerCode();
        const customer = await prisma.customer.create({
          data: {
            id: uuid(),
            customerCode,
            customerName: body.customerName.trim(),
            email: body.email?.trim() || null,
            phone: body.phone?.trim() || null,
            customerType: body.customerType || 'Individual',
            preferredSalesChannelId: body.preferredSalesChannelId || null,
            city: body.city || '',
            province: body.province || '',
            country: body.country || 'Indonesia',
            notes: body.notes || '',
            status: body.status || 'Active',
          },
          include: { preferredSalesChannel: { select: { id: true, channelName: true, channelCode: true } } },
        });
        return NextResponse.json(customer);
      }

      // Update customer
      if (method === 'PUT' && segs.length === 2) {
        const body = await readJson(request);
        if (body.customerName !== undefined && !body.customerName?.trim())
          return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });

        const emailVal = body.email?.trim() || null;
        const phoneVal = body.phone?.trim() || null;

        if (emailVal === null && phoneVal === null)
          return NextResponse.json({ error: 'At least one of Email or Phone is required' }, { status: 400 });

        // Uniqueness checks (exclude self)
        if (emailVal) {
          const existing = await prisma.customer.findFirst({ where: { email: emailVal, id: { not: segs[1] } } });
          if (existing) return NextResponse.json({ error: `Email ${emailVal} is already used by ${existing.customerName} (${existing.customerCode})` }, { status: 409 });
        }
        if (phoneVal) {
          const existing = await prisma.customer.findFirst({ where: { phone: phoneVal, id: { not: segs[1] } } });
          if (existing) return NextResponse.json({ error: `Phone ${phoneVal} is already used by ${existing.customerName} (${existing.customerCode})` }, { status: 409 });
        }

        const { id: _id, customerCode: _code, createdAt: _ca, updatedAt: _ua, preferredSalesChannel: _psc, ...rest } = body;
        const updated = await prisma.customer.update({
          where: { id: segs[1] },
          data: {
            ...rest,
            email: emailVal,
            phone: phoneVal,
            preferredSalesChannelId: body.preferredSalesChannelId || null,
          },
          include: { preferredSalesChannel: { select: { id: true, channelName: true, channelCode: true } } },
        });
        return NextResponse.json(updated);
      }

      // Soft delete
      if (method === 'DELETE' && segs.length === 2) {
        const updated = await prisma.customer.update({
          where: { id: segs[1] },
          data: { status: 'Inactive' },
        });
        return NextResponse.json(updated);
      }
    }

    // Public products endpoint
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
    // Detect PostgreSQL connection termination errors and reconnect so
    // the NEXT request succeeds. Codes: E57P01 (admin_shutdown),
    // P1017 (server closed connection), P1001 (unreachable server).
    const msg = e?.message || '';
    const isConnErr =
      ['P1017', 'P1001'].includes(e?.code) ||
      msg.includes('E57P01') ||
      msg.includes('terminating connection') ||
      msg.includes('Server has closed the connection') ||
      msg.includes('Connection pool timeout') ||
      msg.includes('Connection reset by peer');
    if (isConnErr) {
      console.warn('[DB] Connection terminated — reconnecting for next request:', msg);
      // Fire-and-forget reconnect so the next request gets a fresh connection.
      prisma.$disconnect()
        .catch(() => {})
        .finally(() => prisma.$connect().catch(() => {}));
      return NextResponse.json(
        { error: 'Database connection was interrupted. Please retry your action.' },
        { status: 503 }
      );
    }
    console.error('API error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
