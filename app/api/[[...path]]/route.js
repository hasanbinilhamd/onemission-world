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
      return NextResponse.json({ total, totalWeight, uniqueColors });
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
    console.error('API error', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
