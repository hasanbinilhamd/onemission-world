import { NextResponse } from 'next/server';
import { checkoutService, normalizeCheckoutError } from '@/lib/checkout';
import { generateCustomerCode } from '@/lib/customer-auth/customer-number';
import { dashboardService } from '@/lib/dashboard';
import { financePostingService } from '@/lib/finance-posting';
import {
  attachHqSessionCookie,
  authenticateHqRequest,
  clearHqSessionCookie,
  ensureHqSecurityDefaults,
  forceLogoutUserSessions,
  getSystemSettingsMap,
  HQ_PERMISSION_CATALOG,
  invalidateHqSettingsCache,
  invalidateRolePermissionsCache,
  HqSecurityError,
  loginHqUser,
  logoutHqSession,
  readBooleanSetting,
  readNumberSetting,
  hashHqPassword,
  requireHqPermission,
  writeAuditLog,
} from '@/lib/hq-security';
import { cashFlowService, inventoryValuationService } from '@/lib/finance-reporting';
import { notificationService, invalidateNotificationSettingsCache } from '@/lib/notifications';
import { paymentAttemptService, normalizePaymentAttemptError } from '@/lib/payment-attempt';
import { prisma } from '@/lib/prisma';
import { reportsService } from '@/lib/reports';
import { getCachedValue, invalidateCacheByPrefix, invalidateCacheKey } from '@/lib/server-cache';
import { districtService } from '@/lib/shipping/district-service';
import { normalizeShippingError, shippingService } from '@/lib/shipping';
import { v4 as uuid } from 'uuid';
import {
  ensureInventoryRowsForProduct,
  repairAllProductInventoryRows,
} from '@/lib/inventory/lifecycle';
import {
  INVENTORY_MOVEMENT_TYPE,
  INVENTORY_PERFORMED_BY,
  INVENTORY_REFERENCE_TYPE,
  inventoryMovementService,
} from '@/lib/inventory/movement-service';

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

function buildShippingErrorResponse(error) {
  const normalized = normalizeShippingError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 }
  );
}

function buildCheckoutErrorResponse(error) {
  const normalized = normalizeCheckoutError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 }
  );
}

function buildPaymentAttemptErrorResponse(error) {
  const normalized = normalizePaymentAttemptError(error);
  return NextResponse.json(
    { error: normalized.message },
    { status: normalized.statusCode || 500 }
  );
}

function buildHqSecurityErrorResponse(error) {
  const normalized = error instanceof HqSecurityError
    ? error
    : new HqSecurityError({
        message: 'Authorization could not be completed.',
        statusCode: 500,
        code: 'HQ_SECURITY_INTERNAL_ERROR',
      });

  return NextResponse.json(
    { error: normalized.message, code: normalized.code },
    { status: normalized.statusCode || 500 },
  );
}

function resolveCatchAllPermission(segs, method) {
  const segment = String(segs[0] || '').trim();

  if (!segment || segment === 'auth' || segment === 'health' || segment === 'shipping' || segment === 'checkout' || segment === 'payment-attempt' || segment === 'payment' || segment === 'payments' || segment === 'commerce' || segment === 'customer') {
    return null;
  }

  if (segment === 'dashboard') return { moduleKey: 'dashboard', actionKey: 'view' };
  if (['productanalytics', 'inventoryanalytics', 'financialanalytics', 'marketinganalytics', 'executivereports'].includes(segment)) {
    return { moduleKey: 'reports', actionKey: 'view' };
  }
  if (['trialbalance', 'profitloss', 'balancesheet', 'cashflow', 'inventoryvaluation', 'finance'].includes(segment)) {
    return { moduleKey: 'finance', actionKey: 'view' };
  }
  if (segment === 'journalentries') {
    return method === 'GET'
      ? { moduleKey: 'finance', actionKey: 'view' }
      : { moduleKey: 'finance', actionKey: 'journal' };
  }
  if (['financialaccounts', 'chartofaccounts'].includes(segment)) {
    return method === 'GET'
      ? { moduleKey: 'finance', actionKey: 'view' }
      : { moduleKey: 'finance', actionKey: 'manage_accounts' };
  }
  if (segment === 'cashtransactions') {
    return method === 'GET'
      ? { moduleKey: 'finance', actionKey: 'view' }
      : null;
  }
  if (['products', 'suppliers', 'bom', 'rawmaterials', 'plans'].includes(segment)) {
    if (method === 'GET') return { moduleKey: 'operations', actionKey: 'view' };
    if (method === 'POST') return { moduleKey: 'operations', actionKey: 'create' };
    if (method === 'PUT') return { moduleKey: 'operations', actionKey: 'update' };
    if (method === 'DELETE') return { moduleKey: 'operations', actionKey: 'delete' };
  }
  if (segment === 'inventory') {
    return method === 'GET'
      ? { moduleKey: 'inventory', actionKey: 'view' }
      : { moduleKey: 'inventory', actionKey: 'adjustment' };
  }
  if (segment === 'stockmovements') {
    return method === 'GET'
      ? { moduleKey: 'inventory', actionKey: 'view' }
      : { moduleKey: 'inventory', actionKey: 'manual_stock' };
  }
  if (['productionorders', 'productionresults'].includes(segment)) {
    if (method === 'GET') return { moduleKey: 'production', actionKey: 'view' };
    if (method === 'POST') return { moduleKey: 'production', actionKey: 'create' };
    if (method === 'PUT') return { moduleKey: 'production', actionKey: 'update' };
    if (method === 'DELETE') return { moduleKey: 'production', actionKey: 'update' };
  }
  if (['content', 'creators', 'schools', 'timeline', 'events'].includes(segment)) {
    if (method === 'GET') return { moduleKey: 'marketing', actionKey: 'view' };
    if (method === 'POST') return { moduleKey: 'marketing', actionKey: 'create' };
    if (method === 'PUT') return { moduleKey: 'marketing', actionKey: 'update' };
    if (method === 'DELETE') return { moduleKey: 'marketing', actionKey: 'delete' };
  }
  if (['saleschannels', 'customers'].includes(segment)) {
    return method === 'GET'
      ? { moduleKey: 'sales', actionKey: 'view' }
      : { moduleKey: 'sales', actionKey: 'manage_master' };
  }
  if (segment === 'notifications') {
    return { moduleKey: 'dashboard', actionKey: 'view' };
  }
  if (segment === 'users') {
    return method === 'GET'
      ? { moduleKey: 'settings', actionKey: 'view' }
      : { moduleKey: 'settings', actionKey: 'manage_users' };
  }
  if (segment === 'roles') {
    return method === 'GET'
      ? { moduleKey: 'settings', actionKey: 'view' }
      : { moduleKey: 'settings', actionKey: 'manage_roles' };
  }
  if (segment === 'notification-settings') {
    return method === 'GET'
      ? { moduleKey: 'settings', actionKey: 'view' }
      : { moduleKey: 'settings', actionKey: 'manage_notifications' };
  }
  if (segment === 'system-settings') {
    return method === 'GET'
      ? { moduleKey: 'settings', actionKey: 'view' }
      : { moduleKey: 'settings', actionKey: 'manage_configuration' };
  }
  if (segment === 'audit-logs') {
    return { moduleKey: 'settings', actionKey: 'view_audit' };
  }

  return null;
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

async function generateProductionResultNumber(prismaClient, resultDate) {
  const date = resultDate ? new Date(resultDate) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const prefix = `PR-${year}${month}${day}-`;

  const existing = await prismaClient.productionResult.findMany({
    where: { resultNumber: { startsWith: prefix } },
    select: { resultNumber: true },
    orderBy: { resultNumber: 'desc' },
  });

  let maxSeq = 0;
  for (const entry of existing) {
    const parts = entry.resultNumber.split('-');
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

function resolveExpenseCategoryName(category, fallbackName = '') {
  return category?.name?.trim() || String(fallbackName || '').trim() || '';
}

function buildCashTransactionJournalDescription({
  transactionType,
  description,
  referenceNumber,
  vendor,
  expenseCategoryName,
  financialAccountName,
}) {
  const txnLabel = transactionType === 'IN' ? 'Cash In' : 'Cash Out';
  const detailParts = [];

  if (transactionType === 'OUT' && expenseCategoryName?.trim()) {
    detailParts.push(expenseCategoryName.trim());
  }

  if (vendor?.trim()) {
    detailParts.push(`Vendor: ${vendor.trim()}`);
  }

  if (referenceNumber?.trim()) {
    detailParts.push(`Reference: ${referenceNumber.trim()}`);
  }

  if (description?.trim()) {
    detailParts.push(description.trim());
  }

  const detail = detailParts.join(' · ').trim();
  return detail ? `${txnLabel}: ${detail}` : `${txnLabel}: ${financialAccountName?.trim() || txnLabel}`;
}

function isCogsAccount(account) {
  const accountCode = String(account?.accountCode || '').trim();
  const accountName = String(account?.accountName || '').trim().toLowerCase();
  return accountCode === '5000' || accountName.includes('cost of goods sold') || accountName.includes('cogs');
}

function isFinishedGoodsInventoryAccount(account) {
  const accountCode = String(account?.accountCode || '').trim();
  const accountName = String(account?.accountName || '').trim().toLowerCase();
  return accountCode === '1500' || accountName.includes('finished goods inventory');
}

const MASTER_DATA_CACHE_TTL_MS = 300_000;

function getReportFilters(url) {
  return {
    range: url.searchParams.get('range') || 'thisMonth',
    from: url.searchParams.get('from') || '',
    to: url.searchParams.get('to') || '',
  };
}

function buildMasterDataCacheKey(name, suffix = '') {
  return `master:${name}:${suffix}`;
}

function normalizeContentPlannerSummary(items = []) {
  return {
    totalPlanned: items.length,
    published: items.filter((item) => item.status === 'Published').length,
    ready: items.filter((item) => item.status === 'Ready').length,
    editing: items.filter((item) => item.status === 'Editing').length,
    draft: items.filter((item) => ['Draft', 'Idea', 'Writing Script', 'Ready To Shoot'].includes(item.status)).length,
  };
}

async function dispatchDueContentReminders(prismaClient) {
  const today = new Date().toISOString().split('T')[0];
  const dueItems = await prismaClient.contentPlanner.findMany({
    where: {
      reminderDate: today,
      reminderNotifiedAt: null,
      status: {
        notIn: ['Published', 'Cancelled'],
      },
    },
    select: {
      id: true,
      title: true,
      publishDate: true,
    },
    take: 25,
  });

  for (const item of dueItems) {
    const reminderMessage = item.publishDate && item.publishDate > today
      ? `Reminder: ${item.title} is scheduled for ${item.publishDate}.`
      : `Reminder: ${item.title} requires attention today.`;

    await notificationService.dispatch({
      type: 'CONTENT_REMINDER',
      payload: {
        contentId: item.id,
        title: item.title,
        message: reminderMessage,
      },
      prismaClient,
    });

    await prismaClient.contentPlanner.update({
      where: { id: item.id },
      data: { reminderNotifiedAt: new Date() },
    });
  }
}

async function handle(request, { params }) {
  const segs = params?.path || [];
  const method = request.method;
  const startedAt = Date.now();

  try {
    await ensureHqSecurityDefaults(prisma);

    const routePermission = resolveCatchAllPermission(segs, method);
    let authContext = null;

    if (routePermission) {
      authContext = await requireHqPermission(request, routePermission.moduleKey, routePermission.actionKey, { prismaClient: prisma });
    }

    // ---------- AUTH ----------
    if (segs[0] === 'auth' && segs[1] === 'login' && method === 'POST') {
      try {
        const payload = await readJson(request);
        const result = await loginHqUser({
          email: payload.email,
          password: payload.password,
          request,
          prismaClient: prisma,
        });
        const response = NextResponse.json({ user: result.user });
        attachHqSessionCookie(response, result.token, result.sessionTimeoutMinutes);
        return response;
      } catch (error) {
        return buildHqSecurityErrorResponse(error);
      }
    }

    if (segs[0] === 'auth' && segs[1] === 'me' && method === 'GET') {
      try {
        const session = await authenticateHqRequest(request, { prismaClient: prisma });
        return NextResponse.json({ user: session.user });
      } catch (error) {
        return buildHqSecurityErrorResponse(error);
      }
    }

    if (segs[0] === 'auth' && segs[1] === 'logout' && method === 'POST') {
      try {
        await logoutHqSession(request, { prismaClient: prisma });
        const response = NextResponse.json({ ok: true });
        clearHqSessionCookie(response);
        return response;
      } catch (error) {
        return buildHqSecurityErrorResponse(error);
      }
    }

    // ---------- SHIPPING ----------
    if (segs[0] === 'shipping') {
      if (segs[1] === 'provinces' && method === 'GET') {
        try {
          const provinces = await shippingService.getProvinces();
          return NextResponse.json(provinces);
        } catch (error) {
          return buildShippingErrorResponse(error);
        }
      }

      if (segs[1] === 'cities' && method === 'GET') {
        const url = new URL(request.url);
        const provinceId = url.searchParams.get('provinceId');

        try {
          const cities = await shippingService.getCities(provinceId);
          return NextResponse.json(cities);
        } catch (error) {
          return buildShippingErrorResponse(error);
        }
      }

      if (segs[1] === 'districts' && method === 'GET') {
        const url = new URL(request.url);
        const cityId = url.searchParams.get('cityId');

        try {
          const districts = await districtService.getDistricts(cityId);
          return NextResponse.json(districts);
        } catch (error) {
          return buildShippingErrorResponse(error);
        }
      }

      if (segs[1] === 'cost' && method === 'POST') {
        const body = await readJson(request);
        const calculateShippingCost = typeof shippingService.calculateShippingCost === 'function'
          ? shippingService.calculateShippingCost.bind(shippingService)
          : shippingService.getShippingCost.bind(shippingService);

        try {
          const costs = await calculateShippingCost({
            originDistrict: body.originDistrict,
            destinationDistrict: body.destinationDistrict,
            weight: body.weight,
            courier: body.courier,
          });
          return NextResponse.json(costs);
        } catch (error) {
          return buildShippingErrorResponse(error);
        }
      }
    }

    // ---------- CHECKOUT ----------
    if (segs[0] === 'checkout' && segs[1] === 'session' && method === 'POST' && segs.length === 2) {
      const body = await readJson(request);

      try {
        const session = await checkoutService.createCheckoutSession(body);
        return NextResponse.json(session);
      } catch (error) {
        return buildCheckoutErrorResponse(error);
      }
    }

    if (segs[0] === 'checkout' && segs[1] === 'session' && method === 'GET' && segs.length === 3) {
      try {
        const session = await checkoutService.getCheckoutSessionById(segs[2]);
        return NextResponse.json(session);
      } catch (error) {
        return buildCheckoutErrorResponse(error);
      }
    }

    // ---------- PAYMENT ATTEMPT ----------
    if (segs[0] === 'payment-attempt' && method === 'POST' && segs.length === 1) {
      const body = await readJson(request);

      try {
        const attempt = await paymentAttemptService.createPaymentAttempt({
          checkoutSessionId: body.checkoutSessionId,
        });
        return NextResponse.json(attempt);
      } catch (error) {
        return buildPaymentAttemptErrorResponse(error);
      }
    }

    // ---------- USERS ----------
    if (segs[0] === 'users') {
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const search = String(url.searchParams.get('search') || '').trim().toLowerCase();
        const role = String(url.searchParams.get('role') || '').trim();
        const status = String(url.searchParams.get('status') || '').trim();
        const users = await prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            sessions: {
              where: { revokedAt: null },
              orderBy: { lastActivityAt: 'desc' },
            },
          },
        });

        const filtered = users.filter((user) => {
          const matchesSearch = !search || [user.name, user.email, user.role].some((value) => String(value || '').toLowerCase().includes(search));
          const matchesRole = !role || role === 'all' || user.role === role;
          const matchesStatus = !status || status === 'all' || user.status === status;
          return matchesSearch && matchesRole && matchesStatus;
        }).map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          status: user.status,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          activeSessionCount: user.sessions.length,
          activeSessions: user.sessions.map((session) => ({
            id: session.id,
            device: session.device,
            browser: session.browser,
            ipAddress: session.ipAddress,
            lastActivityAt: session.lastActivityAt,
            createdAt: session.createdAt,
          })),
        }));

        return NextResponse.json(filtered);
      }

      if (method === 'POST' && segs.length === 1) {
        const payload = await readJson(request);
        const settings = await getSystemSettingsMap(prisma);
        const passwordMinimumLength = readNumberSetting(settings.password_minimum_length, 8);
        const name = String(payload.name || '').trim();
        const email = String(payload.email || '').trim().toLowerCase();
        const role = String(payload.role || '').trim();
        const password = String(payload.password || '');

        if (!name || !email || !role || !password) {
          return NextResponse.json({ error: 'name, email, role, and password are required' }, { status: 400 });
        }
        if (password.length < passwordMinimumLength) {
          return NextResponse.json({ error: `Password must be at least ${passwordMinimumLength} characters long.` }, { status: 400 });
        }

        const existingUser = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
        if (existingUser) {
          return NextResponse.json({ error: 'Email is already used by another user.' }, { status: 400 });
        }

        const roleRecord = await prisma.role.findFirst({ where: { name: role } });
        if (!roleRecord) {
          return NextResponse.json({ error: 'Selected role was not found.' }, { status: 404 });
        }

        const passwordHash = await hashHqPassword(password);
        const user = await prisma.user.create({
          data: {
            id: uuid(),
            name,
            email,
            role,
            avatar: String(payload.avatar || name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()).trim(),
            password,
            passwordHash,
            passwordChangedAt: new Date(),
            status: payload.status === 'Inactive' ? 'Inactive' : 'Active',
          },
        });

        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'SETTINGS',
          action: 'USER_CREATED',
          description: `Created user ${user.email}.`,
          metadata: { targetUserId: user.id },
        });

        await notificationService.dispatch({
          type: 'USER_CREATED',
          payload: {
            userId: user.id,
            email: user.email,
            name: user.name,
          },
          prismaClient: prisma,
        });

        return NextResponse.json(user);
      }

      if (method === 'GET' && segs.length === 2) {
        const user = await prisma.user.findUnique({
          where: { id: segs[1] },
          include: {
            sessions: {
              where: { revokedAt: null },
              orderBy: { lastActivityAt: 'desc' },
            },
          },
        });
        if (!user) {
          return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }
        return NextResponse.json(user);
      }

      if (method === 'PUT' && segs.length === 2) {
        const payload = await readJson(request);
        const existingUser = await prisma.user.findUnique({ where: { id: segs[1] } });
        if (!existingUser) {
          return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        const updateData = {};
        if (payload.name !== undefined) updateData.name = String(payload.name || '').trim();
        if (payload.email !== undefined) updateData.email = String(payload.email || '').trim().toLowerCase();
        if (payload.role !== undefined) updateData.role = String(payload.role || '').trim();
        if (payload.avatar !== undefined) updateData.avatar = String(payload.avatar || '').trim();
        if (payload.status !== undefined) updateData.status = payload.status === 'Inactive' ? 'Inactive' : 'Active';

        if (updateData.email) {
          const duplicate = await prisma.user.findFirst({
            where: {
              id: { not: segs[1] },
              email: { equals: updateData.email, mode: 'insensitive' },
            },
          });
          if (duplicate) {
            return NextResponse.json({ error: 'Email is already used by another user.' }, { status: 400 });
          }
        }

        if (updateData.role) {
          const roleRecord = await prisma.role.findFirst({ where: { name: updateData.role } });
          if (!roleRecord) {
            return NextResponse.json({ error: 'Selected role was not found.' }, { status: 404 });
          }
        }

        const updatedUser = await prisma.user.update({
          where: { id: segs[1] },
          data: updateData,
        });

        if (updateData.status === 'Inactive') {
          await forceLogoutUserSessions({
            prismaClient: prisma,
            userId: updatedUser.id,
            revokedBy: authContext?.user,
          });
        }

        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'SETTINGS',
          action: updateData.role && updateData.role !== existingUser.role ? 'ROLE_CHANGED' : 'USER_UPDATED',
          description: updateData.role && updateData.role !== existingUser.role
            ? `Changed role for ${updatedUser.email} from ${existingUser.role} to ${updateData.role}.`
            : `Updated user ${updatedUser.email}.`,
          metadata: { targetUserId: updatedUser.id, changes: Object.keys(updateData) },
        });

        return NextResponse.json(updatedUser);
      }

      if (method === 'GET' && segs.length === 3 && segs[2] === 'sessions') {
        const sessions = await prisma.userSession.findMany({
          where: { userId: segs[1], revokedAt: null },
          orderBy: { lastActivityAt: 'desc' },
        });
        return NextResponse.json(sessions);
      }

      if (method === 'POST' && segs.length === 3 && segs[2] === 'reset-password') {
        const payload = await readJson(request);
        const settings = await getSystemSettingsMap(prisma);
        const passwordMinimumLength = readNumberSetting(settings.password_minimum_length, 8);
        const nextPassword = String(payload.password || '').trim();
        if (!nextPassword || nextPassword.length < passwordMinimumLength) {
          return NextResponse.json({ error: `Password must be at least ${passwordMinimumLength} characters long.` }, { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({ where: { id: segs[1] } });
        if (!existingUser) {
          return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        const passwordHash = await hashHqPassword(nextPassword);
        await prisma.user.update({
          where: { id: segs[1] },
          data: {
            password: nextPassword,
            passwordHash,
            passwordChangedAt: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });

        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'SETTINGS',
          action: 'PASSWORD_RESET',
          description: `Reset password for user ${existingUser.email}.`,
          metadata: { targetUserId: existingUser.id },
        });

        return NextResponse.json({ ok: true });
      }

      if (method === 'POST' && segs.length === 3 && segs[2] === 'force-logout') {
        const count = await forceLogoutUserSessions({
          prismaClient: prisma,
          userId: segs[1],
          revokedBy: authContext?.user,
        });
        return NextResponse.json({ ok: true, count });
      }

      if (method === 'POST' && segs.length === 5 && segs[2] === 'sessions' && segs[4] === 'force-logout') {
        const session = await prisma.userSession.findFirst({ where: { id: segs[3], userId: segs[1], revokedAt: null } });
        if (!session) {
          return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
        }
        await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'SETTINGS',
          action: 'FORCE_LOGOUT',
          description: `Force logout session ${session.id} for user ${segs[1]}.`,
          metadata: { sessionId: session.id, targetUserId: segs[1] },
        });
        return NextResponse.json({ ok: true });
      }
    }

    // ---------- ROLES & PERMISSIONS ----------
    if (segs[0] === 'roles') {
      if (method === 'GET' && segs.length === 1) {
        const result = await getCachedValue(buildMasterDataCacheKey('roles'), MASTER_DATA_CACHE_TTL_MS, async () => {
          const roles = await prisma.role.findMany({
            include: {
              permissions: true,
            },
            orderBy: { name: 'asc' },
          });

          const matrix = HQ_PERMISSION_CATALOG.map((module) => ({
            moduleKey: module.moduleKey,
            label: module.label,
            actions: module.actions,
          }));

          return { roles, matrix };
        });

        return NextResponse.json(result);
      }

      if (method === 'POST' && segs.length === 1) {
        const payload = await readJson(request);
        const name = String(payload.name || '').trim();
        if (!name) {
          return NextResponse.json({ error: 'Role name is required.' }, { status: 400 });
        }

        const existing = await prisma.role.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
        if (existing) {
          return NextResponse.json({ error: 'Role name already exists.' }, { status: 400 });
        }

        const role = await prisma.role.create({
          data: {
            id: uuid(),
            name,
            description: String(payload.description || '').trim(),
            status: payload.status === 'Inactive' ? 'Inactive' : 'Active',
            isSystem: false,
          },
        });
        invalidateCacheByPrefix(buildMasterDataCacheKey('roles'));
        invalidateRolePermissionsCache();

        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'SETTINGS',
          action: 'ROLE_CREATED',
          description: `Created role ${role.name}.`,
          metadata: { roleId: role.id },
        });

        return NextResponse.json(role);
      }

      if (method === 'PUT' && segs.length === 2) {
        const payload = await readJson(request);
        const existingRole = await prisma.role.findUnique({ where: { id: segs[1] }, include: { permissions: true } });
        if (!existingRole) {
          return NextResponse.json({ error: 'Role not found.' }, { status: 404 });
        }

        const nextName = payload.name !== undefined ? String(payload.name || '').trim() : existingRole.name;
        if (!nextName) {
          return NextResponse.json({ error: 'Role name is required.' }, { status: 400 });
        }

        const duplicate = await prisma.role.findFirst({
          where: {
            id: { not: segs[1] },
            name: { equals: nextName, mode: 'insensitive' },
          },
        });
        if (duplicate) {
          return NextResponse.json({ error: 'Role name already exists.' }, { status: 400 });
        }

        const updatedRole = await prisma.$transaction(async (tx) => {
          const role = await tx.role.update({
            where: { id: segs[1] },
            data: {
              name: nextName,
              description: payload.description !== undefined ? String(payload.description || '').trim() : existingRole.description,
              status: payload.status !== undefined ? (payload.status === 'Inactive' ? 'Inactive' : 'Active') : existingRole.status,
            },
          });

          if (Array.isArray(payload.permissions)) {
            await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
            const permissions = payload.permissions
              .filter((permission) => permission?.moduleKey && permission?.actionKey && permission?.isAllowed !== false)
              .map((permission) => ({
                id: uuid(),
                roleId: role.id,
                moduleKey: String(permission.moduleKey).trim(),
                actionKey: String(permission.actionKey).trim(),
                isAllowed: true,
              }));
            if (permissions.length > 0) {
              await tx.rolePermission.createMany({ data: permissions });
            }
          }

          if (existingRole.name !== role.name) {
            await tx.user.updateMany({
              where: { role: existingRole.name },
              data: { role: role.name },
            });
          }

          return tx.role.findUnique({
            where: { id: role.id },
            include: { permissions: true },
          });
        });

        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'SETTINGS',
          action: Array.isArray(payload.permissions) ? 'PERMISSION_CHANGED' : 'ROLE_UPDATED',
          description: Array.isArray(payload.permissions)
            ? `Updated permission matrix for role ${updatedRole?.name || nextName}.`
            : `Updated role ${updatedRole?.name || nextName}.`,
          metadata: { roleId: segs[1] },
        });

        await notificationService.dispatch({
          type: 'ROLE_UPDATED',
          payload: {
            roleId: segs[1],
            roleName: updatedRole?.name || nextName,
          },
          prismaClient: prisma,
        });

        invalidateCacheByPrefix(buildMasterDataCacheKey('roles'));
        invalidateRolePermissionsCache();

        return NextResponse.json(updatedRole);
      }
    }

    // ---------- NOTIFICATION SETTINGS ----------
    if (segs[0] === 'notification-settings') {
      if (method === 'GET' && segs.length === 1) {
        const settings = await getCachedValue(buildMasterDataCacheKey('notification-settings'), MASTER_DATA_CACHE_TTL_MS, async () => (
          prisma.notificationSetting.findMany({ orderBy: [{ category: 'asc' }, { label: 'asc' }] })
        ));
        return NextResponse.json(settings);
      }

      if (method === 'PUT' && segs.length === 1) {
        const payload = await readJson(request);
        const settings = Array.isArray(payload.settings) ? payload.settings : [];
        await prisma.$transaction(settings.map((setting) => prisma.notificationSetting.update({
          where: { id: setting.id },
          data: {
            isEnabled: Boolean(setting.isEnabled),
            updatedBy: authContext?.user?.email || authContext?.user?.name || '',
          },
        })));

        invalidateNotificationSettingsCache();
        invalidateCacheKey(buildMasterDataCacheKey('notification-settings'));

        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'SETTINGS',
          action: 'NOTIFICATION_SETTINGS_UPDATED',
          description: 'Notification settings were updated.',
          metadata: { count: settings.length },
        });

        return NextResponse.json({ ok: true });
      }
    }

    // ---------- SYSTEM SETTINGS ----------
    if (segs[0] === 'system-settings') {
      if (method === 'GET' && segs.length === 1) {
        const settings = await getCachedValue(buildMasterDataCacheKey('system-settings'), MASTER_DATA_CACHE_TTL_MS, async () => (
          prisma.systemSetting.findMany({ orderBy: [{ section: 'asc' }, { label: 'asc' }] })
        ));
        return NextResponse.json(settings);
      }

      if (method === 'PUT' && segs.length === 1) {
        const payload = await readJson(request);
        const settings = Array.isArray(payload.settings) ? payload.settings : [];
        const currentSettings = await prisma.systemSetting.findMany({ where: { id: { in: settings.map((setting) => setting.id) } } });
        const currentSettingsMap = new Map(currentSettings.map((setting) => [setting.id, setting]));
        const thresholdUpdate = settings.find((setting) => currentSettingsMap.get(setting.id)?.settingKey === 'default_minimum_stock_threshold');

        await prisma.$transaction(settings.map((setting) => prisma.systemSetting.update({
          where: { id: setting.id },
          data: {
            value: String(setting.value ?? ''),
            updatedBy: authContext?.user?.email || authContext?.user?.name || '',
          },
        })));

        if (thresholdUpdate) {
          const nextThreshold = Number(thresholdUpdate.value);
          if (Number.isFinite(nextThreshold) && nextThreshold >= 0) {
            await prisma.inventory.updateMany({
              data: { threshold: Math.trunc(nextThreshold) },
            });
          }
        }

        invalidateHqSettingsCache();
        invalidateCacheKey(buildMasterDataCacheKey('system-settings'));

        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'SETTINGS',
          action: 'CONFIGURATION_CHANGED',
          description: 'System configuration was updated.',
          metadata: { count: settings.length },
        });

        return NextResponse.json({ ok: true });
      }
    }

    // ---------- AUDIT LOGS ----------
    if (segs[0] === 'audit-logs' && method === 'GET') {
      const url = new URL(request.url);
      const search = String(url.searchParams.get('search') || '').trim().toLowerCase();
      const moduleFilter = String(url.searchParams.get('module') || '').trim();
      const actionFilter = String(url.searchParams.get('action') || '').trim();
      const logs = await prisma.auditLog.findMany({
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      });

      const filteredLogs = logs.filter((log) => {
        const matchesSearch = !search || [log.userName, log.module, log.action, log.description].some((value) => String(value || '').toLowerCase().includes(search));
        const matchesModule = !moduleFilter || moduleFilter === 'all' || log.module === moduleFilter;
        const matchesAction = !actionFilter || actionFilter === 'all' || log.action === actionFilter;
        return matchesSearch && matchesModule && matchesAction;
      });

      return NextResponse.json(filteredLogs);
    }

    // ---------- NOTIFICATIONS ----------
    if (segs[0] === 'notifications') {
      if (segs[1] === 'summary' && method === 'GET') {
        await dispatchDueContentReminders(prisma);
        const summary = await notificationService.getSummary({ prismaClient: prisma });
        return NextResponse.json(summary);
      }

      if (segs[1] === 'mark-all-read' && method === 'POST') {
        await notificationService.markAllRead({ prismaClient: prisma });
        return NextResponse.json({ ok: true });
      }

      if (segs[1] === 'read' && method === 'DELETE') {
        const result = await notificationService.deleteRead({ prismaClient: prisma });
        return NextResponse.json({ ok: true, count: result.count });
      }

      if (method === 'GET' && segs.length === 1) {
        await dispatchDueContentReminders(prisma);
        const url = new URL(request.url);
        const result = await notificationService.list({
          prismaClient: prisma,
          search: url.searchParams.get('search') || '',
          status: url.searchParams.get('status') || 'all',
          severity: url.searchParams.get('severity') || 'all',
          page: url.searchParams.get('page') || 1,
          limit: url.searchParams.get('limit') || 20,
        });
        return NextResponse.json(result);
      }

      if (method === 'PUT' && segs.length === 2) {
        const updated = await notificationService.markRead(segs[1], { prismaClient: prisma });
        if (!updated) {
          return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
        }
        return NextResponse.json(updated);
      }
    }

    // ---------- DASHBOARD STATS ----------
    if (segs[0] === 'dashboard' && method === 'GET') {
      const url = new URL(request.url);
      const range = url.searchParams.get('range') || 'last30';
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      const scope = url.searchParams.get('scope') || 'full';
      const result = scope === 'summary'
        ? await dashboardService.getExecutiveDashboardSummary({ range, from, to })
        : scope === 'details'
          ? await dashboardService.getExecutiveDashboardDetails({ range, from, to })
          : await dashboardService.getExecutiveDashboard({ range, from, to });
      return NextResponse.json(result);
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
      const docs = await getCachedValue(buildMasterDataCacheKey('financialaccounts'), MASTER_DATA_CACHE_TTL_MS, async () => (
        prisma.financialAccount.findMany({
          orderBy: { name: 'asc' },
          include: { linkedCoa: { select: { id: true, accountCode: true, accountName: true } } },
        })
      ));
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

    if (segs[0] === 'chartofaccounts' && method === 'GET' && segs.length === 1) {
      const docs = await getCachedValue(buildMasterDataCacheKey('chartofaccounts'), MASTER_DATA_CACHE_TTL_MS, async () => (
        prisma.chartOfAccount.findMany({
          orderBy: { accountCode: 'asc' },
        })
      ));
      return NextResponse.json(docs);
    }

    // ---------- EXPENSE CATEGORIES ----------
    if (segs[0] === 'expensecategories') {
      if (segs[1] === 'stats' && method === 'GET') {
        const stats = await getCachedValue(buildMasterDataCacheKey('expensecategories', 'stats'), MASTER_DATA_CACHE_TTL_MS, async () => {
          const all = await prisma.expenseCategory.findMany({ select: { status: true } });
          const total = all.length;
          const active = all.filter((item) => (item.status || 'Active') === 'Active').length;
          const archived = all.filter((item) => item.status === 'Archived').length;
          return { total, active, archived };
        });
        return NextResponse.json(stats);
      }

      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || 'all';
        const where = {};

        if (status !== 'all') {
          where.status = status;
        }

        if (search.trim()) {
          where.OR = [
            { name: { contains: search.trim(), mode: 'insensitive' } },
            { description: { contains: search.trim(), mode: 'insensitive' } },
          ];
        }

        const cacheKey = buildMasterDataCacheKey('expensecategories', `${status}:${search.trim().toLowerCase()}`);
        const docs = await getCachedValue(cacheKey, MASTER_DATA_CACHE_TTL_MS, async () => (
          prisma.expenseCategory.findMany({
            where,
            include: {
              _count: { select: { cashTransactions: true } },
            },
            orderBy: [
              { status: 'asc' },
              { name: 'asc' },
            ],
          })
        ));
        return NextResponse.json(docs);
      }

      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        const name = String(body.name || '').trim();
        const description = String(body.description || '').trim();
        const status = body.status === 'Archived' ? 'Archived' : 'Active';

        if (!name) {
          return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const existing = await prisma.expenseCategory.findFirst({
          where: { name: { equals: name, mode: 'insensitive' } },
        });
        if (existing) {
          return NextResponse.json({ error: 'Expense category name already exists' }, { status: 400 });
        }

        const doc = await prisma.expenseCategory.create({
          data: {
            id: uuid(),
            name,
            description,
            status,
          },
        });
        invalidateCacheByPrefix(buildMasterDataCacheKey('expensecategories', ''));
        return NextResponse.json(doc);
      }

      if (method === 'PUT' && segs.length === 2) {
        const body = await readJson(request);
        const existing = await prisma.expenseCategory.findUnique({ where: { id: segs[1] } });
        if (!existing) {
          return NextResponse.json({ error: 'Expense category not found' }, { status: 404 });
        }

        const name = body.name !== undefined ? String(body.name || '').trim() : existing.name;
        const description = body.description !== undefined ? String(body.description || '').trim() : existing.description;
        const status = body.status === 'Archived' ? 'Archived' : 'Active';

        if (!name) {
          return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const duplicate = await prisma.expenseCategory.findFirst({
          where: {
            id: { not: segs[1] },
            name: { equals: name, mode: 'insensitive' },
          },
        });
        if (duplicate) {
          return NextResponse.json({ error: 'Expense category name already exists' }, { status: 400 });
        }

        const updated = await prisma.expenseCategory.update({
          where: { id: segs[1] },
          data: {
            name,
            description,
            status,
          },
        });

        invalidateCacheByPrefix(buildMasterDataCacheKey('expensecategories', ''));

        await prisma.cashTransaction.updateMany({
          where: { expenseCategoryId: segs[1] },
          data: { expenseCategoryName: updated.name },
        });

        return NextResponse.json(updated);
      }

      if (method === 'DELETE' && segs.length === 2) {
        const inUseCount = await prisma.cashTransaction.count({ where: { expenseCategoryId: segs[1] } });
        if (inUseCount > 0) {
          return NextResponse.json({
            error: 'Expense category cannot be deleted because it is already used in cash out transactions',
          }, { status: 400 });
        }

        await prisma.expenseCategory.delete({ where: { id: segs[1] } });
        invalidateCacheByPrefix(buildMasterDataCacheKey('expensecategories', ''));
        return NextResponse.json({ ok: true });
      }
    }

    // ---------- CASH TRANSACTIONS ----------
    if (segs[0] === 'cashtransactions') {
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const type = url.searchParams.get('type');
        const where = type ? { transactionType: type } : {};
        const docs = await prisma.cashTransaction.findMany({
          where,
          include: {
            financialAccount: true,
            chartOfAccount: true,
            expenseCategory: true,
          },
          orderBy: [
            { transactionDate: 'desc' },
            { createdAt: 'desc' },
          ],
        });

        const journalSourceIds = docs.map((doc) => doc.id);
        const journals = journalSourceIds.length
          ? await prisma.journalEntry.findMany({
              where: {
                sourceId: { in: journalSourceIds },
                journalType: 'System',
              },
              select: {
                id: true,
                sourceId: true,
                journalNumber: true,
                status: true,
                description: true,
                journalDate: true,
              },
            })
          : [];
        const journalMap = new Map(journals.map((journal) => [journal.sourceId, journal]));

        return NextResponse.json(
          docs.map((doc) => ({
            ...doc,
            systemJournal: journalMap.get(doc.id) || null,
          })),
        );
      }

      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        const transactionType = body.transactionType === 'IN' ? 'IN' : 'OUT';
        authContext = await requireHqPermission(request, 'finance', transactionType === 'IN' ? 'cash_in' : 'cash_out', { prismaClient: prisma });

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

        let expenseCategory = null;
        let expenseCategoryName = '';
        if (transactionType === 'OUT') {
          if (!body.expenseCategoryId) {
            return NextResponse.json({ error: 'expenseCategory is required for cash out' }, { status: 400 });
          }

          expenseCategory = await prisma.expenseCategory.findUnique({ where: { id: body.expenseCategoryId } });
          if (!expenseCategory) {
            return NextResponse.json({ error: 'Expense category not found' }, { status: 400 });
          }

          expenseCategoryName = resolveExpenseCategoryName(expenseCategory, body.expenseCategoryName);
        }

        const paymentMethod = transactionType === 'OUT' ? String(body.paymentMethod || '').trim() : '';
        const description = String(body.description || '').trim();
        const vendor = transactionType === 'OUT' ? String(body.vendor || '').trim() : '';
        const notes = transactionType === 'OUT' ? String(body.notes || '').trim() : '';
        const referenceNumber = String(body.referenceNumber || '').trim();
        const attachment = String(body.attachment || '').trim();
        const createdBy = String(body.createdBy || '').trim();
        const amount = Number(body.amount);

        const doc = await prisma.cashTransaction.create({
          data: {
            id: uuid(),
            transactionDate: body.transactionDate,
            transactionType,
            financialAccountId: body.financialAccountId,
            chartOfAccountId: body.chartOfAccountId,
            expenseCategoryId: expenseCategory?.id || null,
            expenseCategoryName,
            amount,
            referenceNumber,
            description,
            vendor,
            paymentMethod,
            attachment,
            notes,
            createdBy,
          },
          include: {
            financialAccount: true,
            chartOfAccount: true,
            expenseCategory: true,
          },
        });

        const journalNumber = await generateJournalNumber(body.transactionDate);
        const txnLabel = transactionType === 'IN' ? 'Cash In' : 'Cash Out';
        const journalDesc = buildCashTransactionJournalDescription({
          transactionType,
          description,
          referenceNumber,
          vendor,
          expenseCategoryName,
          financialAccountName: fa.name,
        });
        const lines = buildCashJournalLines(
          transactionType,
          fa.linkedCoaId,
          body.chartOfAccountId,
          amount,
          journalDesc,
        );

        const journal = await prisma.journalEntry.create({
          data: {
            id: uuid(),
            journalNumber,
            journalDate: body.transactionDate,
            description: journalDesc,
            referenceNumber,
            journalSource: txnLabel,
            sourceId: doc.id,
            journalType: 'System',
            status: 'Posted',
            totalDebit: amount,
            totalCredit: amount,
            createdBy,
            updatedBy: createdBy,
            lines: {
              create: lines.map((line) => ({ id: uuid(), ...line })),
            },
          },
          select: {
            id: true,
            journalNumber: true,
            status: true,
            description: true,
            journalDate: true,
          },
        });

        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'FINANCE',
          action: transactionType === 'IN' ? 'CASH_IN_CREATED' : 'CASH_OUT_CREATED',
          description: `${transactionType === 'IN' ? 'Cash In' : 'Cash Out'} transaction ${referenceNumber || doc.id} was created.`,
          metadata: { transactionId: doc.id, amount },
        });

        await notificationService.dispatch({
          type: transactionType === 'IN' ? 'CASH_IN_CREATED' : 'CASH_OUT_CREATED',
          payload: {
            transactionId: doc.id,
            referenceNumber,
            amount,
            amountFormatted: `Rp ${Number(amount || 0).toLocaleString('id-ID')}`,
          },
          prismaClient: prisma,
        });

        return NextResponse.json({
          ...doc,
          systemJournal: journal,
        });
      }

      if (method === 'PUT' && segs.length === 2) {
        const body = await readJson(request);
        const existingTxn = await prisma.cashTransaction.findUnique({ where: { id: segs[1] } });
        if (!existingTxn) {
          return NextResponse.json({ error: 'Cash transaction not found' }, { status: 404 });
        }
        authContext = authContext = await requireHqPermission(request, 'finance', existingTxn.transactionType === 'IN' ? 'cash_in' : 'cash_out', { prismaClient: prisma });

        if (body.amount !== undefined && Number(body.amount) <= 0)
          return NextResponse.json({ error: 'amount must be greater than 0' }, { status: 400 });

        if (body.chartOfAccountId) {
          const coa = await prisma.chartOfAccount.findUnique({ where: { id: body.chartOfAccountId } });
          if (!coa || !coa.allowTransaction)
            return NextResponse.json({ error: 'Selected account does not allow transactions' }, { status: 400 });
        }

        const transactionType = body.transactionType === 'IN' ? 'IN' : existingTxn.transactionType;
        const faId = body.financialAccountId || existingTxn.financialAccountId;
        const fa = faId ? await prisma.financialAccount.findUnique({ where: { id: faId } }) : null;

        if (fa && !fa.linkedCoaId)
          return NextResponse.json({
            error: 'Financial account has no linked COA account. Please configure it in Financial Accounts settings.',
          }, { status: 400 });

        let expenseCategory = null;
        let expenseCategoryName = existingTxn.expenseCategoryName || '';
        if (transactionType === 'OUT') {
          const expenseCategoryId = body.expenseCategoryId !== undefined
            ? body.expenseCategoryId || null
            : existingTxn.expenseCategoryId || null;

          if (!expenseCategoryId) {
            return NextResponse.json({ error: 'expenseCategory is required for cash out' }, { status: 400 });
          }

          expenseCategory = await prisma.expenseCategory.findUnique({ where: { id: expenseCategoryId } });
          if (!expenseCategory) {
            return NextResponse.json({ error: 'Expense category not found' }, { status: 400 });
          }

          expenseCategoryName = resolveExpenseCategoryName(expenseCategory, body.expenseCategoryName || existingTxn.expenseCategoryName);
        }

        const updateData = {};
        if (body.transactionDate !== undefined) updateData.transactionDate = body.transactionDate;
        if (body.financialAccountId !== undefined) updateData.financialAccountId = body.financialAccountId;
        if (body.chartOfAccountId !== undefined) updateData.chartOfAccountId = body.chartOfAccountId;
        if (body.amount !== undefined) updateData.amount = Number(body.amount);
        if (body.referenceNumber !== undefined) updateData.referenceNumber = String(body.referenceNumber || '').trim();
        if (body.description !== undefined) updateData.description = String(body.description || '').trim();
        if (body.attachment !== undefined) updateData.attachment = String(body.attachment || '').trim();
        if (body.createdBy !== undefined) updateData.createdBy = String(body.createdBy || '').trim();
        if (transactionType === 'OUT') {
          updateData.expenseCategoryId = expenseCategory?.id || null;
          updateData.expenseCategoryName = expenseCategoryName;
          if (body.vendor !== undefined) updateData.vendor = String(body.vendor || '').trim();
          if (body.paymentMethod !== undefined) updateData.paymentMethod = String(body.paymentMethod || '').trim();
          if (body.notes !== undefined) updateData.notes = String(body.notes || '').trim();
        } else {
          updateData.expenseCategoryId = null;
          updateData.expenseCategoryName = '';
          updateData.vendor = '';
          updateData.paymentMethod = '';
          updateData.notes = '';
        }

        const updated = await prisma.cashTransaction.update({
          where: { id: segs[1] },
          data: updateData,
          include: {
            financialAccount: true,
            chartOfAccount: true,
            expenseCategory: true,
          },
        });

        const journal = await prisma.journalEntry.findFirst({
          where: { sourceId: segs[1], journalType: 'System' },
        });

        if (journal && fa?.linkedCoaId) {
          const amount = updated.amount;
          const journalDesc = buildCashTransactionJournalDescription({
            transactionType: updated.transactionType,
            description: updated.description,
            referenceNumber: updated.referenceNumber,
            vendor: updated.vendor,
            expenseCategoryName: updated.expenseCategoryName,
            financialAccountName: updated.financialAccount?.name || fa.name,
          });
          const newLines = buildCashJournalLines(
            updated.transactionType,
            fa.linkedCoaId,
            updated.chartOfAccountId,
            amount,
            journalDesc,
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
              updatedBy: updated.createdBy || journal.createdBy || '',
              lines: {
                create: newLines.map((line) => ({ id: uuid(), ...line })),
              },
            },
          });
        }

        const latestJournal = journal
          ? await prisma.journalEntry.findUnique({
              where: { id: journal.id },
              select: {
                id: true,
                sourceId: true,
                journalNumber: true,
                status: true,
                description: true,
                journalDate: true,
              },
            })
          : null;

        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'FINANCE',
          action: updated.transactionType === 'IN' ? 'CASH_IN_UPDATED' : 'CASH_OUT_UPDATED',
          description: `${updated.transactionType === 'IN' ? 'Cash In' : 'Cash Out'} transaction ${updated.referenceNumber || updated.id} was updated.`,
          metadata: { transactionId: updated.id, amount: updated.amount },
        });

        return NextResponse.json({
          ...updated,
          systemJournal: latestJournal,
        });
      }

      if (method === 'DELETE' && segs.length === 2) {
        const existingTxn = await prisma.cashTransaction.findUnique({ where: { id: segs[1] } });
        if (!existingTxn) {
          return NextResponse.json({ error: 'Cash transaction not found' }, { status: 404 });
        }
        await requireHqPermission(request, 'finance', existingTxn.transactionType === 'IN' ? 'cash_in' : 'cash_out', { prismaClient: prisma });

        const journal = await prisma.journalEntry.findFirst({
          where: { sourceId: segs[1], journalType: 'System' },
        });
        if (journal) {
          await prisma.journalEntry.delete({ where: { id: journal.id } });
        }

        await prisma.cashTransaction.delete({ where: { id: segs[1] } });
        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'FINANCE',
          action: existingTxn.transactionType === 'IN' ? 'CASH_IN_DELETED' : 'CASH_OUT_DELETED',
          description: `${existingTxn.transactionType === 'IN' ? 'Cash In' : 'Cash Out'} transaction ${existingTxn.referenceNumber || existingTxn.id} was deleted.`,
          metadata: { transactionId: existingTxn.id },
        });
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
      const from = url.searchParams.get('from') || '';
      const to = url.searchParams.get('to') || '';
      const financialAccountId = url.searchParams.get('financialAccountId') || '';

      const result = await cashFlowService.buildReport({
        from,
        to,
        financialAccountId,
      });

      return NextResponse.json(result);
    }

    // ---------- PRODUCT ANALYTICS ----------
    if (segs[0] === 'productanalytics' && method === 'GET') {
      const url = new URL(request.url);
      const result = await reportsService.getProductAnalytics(getReportFilters(url));
      return NextResponse.json(result);
    }

    // ---------- INVENTORY ANALYTICS ----------
    if (segs[0] === 'inventoryanalytics' && method === 'GET') {
      const url = new URL(request.url);
      const result = await reportsService.getInventoryAnalytics(getReportFilters(url));
      return NextResponse.json(result);
    }

    // ---------- FINANCIAL ANALYTICS ----------
    if (segs[0] === 'financialanalytics' && method === 'GET') {
      const url = new URL(request.url);
      const result = await reportsService.getFinancialAnalytics(getReportFilters(url));
      return NextResponse.json(result);
    }

    // ---------- MARKETING ANALYTICS ----------
    if (segs[0] === 'marketinganalytics' && method === 'GET') {
      const url = new URL(request.url);
      const result = await reportsService.getMarketingAnalytics(getReportFilters(url));
      return NextResponse.json(result);
    }

    // ---------- EXECUTIVE REPORTS ----------
    if (segs[0] === 'executivereports' && method === 'GET') {
      const url = new URL(request.url);
      const result = await reportsService.getExecutiveReport(getReportFilters(url));
      return NextResponse.json(result);
    }

    // ---------- INVENTORY VALUATION ----------
    if (segs[0] === 'inventoryvaluation' && method === 'GET') {
      const url = new URL(request.url);
      const search = url.searchParams.get('search') || '';
      const result = await inventoryValuationService.buildReport({ search });
      return NextResponse.json(result);
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
          revenueRows: [],
          cogsRows: [],
          operatingExpenseRows: [],
          expenseRows: [],
          totalRevenue: 0,
          totalCogs: 0,
          grossProfit: 0,
          totalOperatingExpenses: 0,
          totalExpenses: 0,
          netProfit: 0,
        });
      }

      const lines = await prisma.journalEntryLine.findMany({
        where: {
          journalEntry: journalFilter,
          chartOfAccountId: { in: accounts.map((a) => a.id) },
        },
        select: {
          chartOfAccountId: true,
          debitAmount: true,
          creditAmount: true,
          journalEntry: {
            select: {
              journalSource: true,
              sourceId: true,
            },
          },
        },
      });

      const cashOutSourceIds = [...new Set(
        lines
          .filter((line) => line.journalEntry?.journalSource === 'Cash Out' && line.journalEntry?.sourceId)
          .map((line) => line.journalEntry.sourceId)
      )];

      const cashOutTransactions = cashOutSourceIds.length
        ? await prisma.cashTransaction.findMany({
            where: { id: { in: cashOutSourceIds } },
            select: {
              id: true,
              expenseCategoryName: true,
              expenseCategory: { select: { name: true } },
            },
          })
        : [];
      const cashOutMap = new Map(cashOutTransactions.map((transaction) => [transaction.id, transaction]));

      const aggMap = {};
      const detailMap = {};
      for (const line of lines) {
        if (!aggMap[line.chartOfAccountId]) {
          aggMap[line.chartOfAccountId] = { totalDebit: 0, totalCredit: 0 };
        }
        aggMap[line.chartOfAccountId].totalDebit += line.debitAmount || 0;
        aggMap[line.chartOfAccountId].totalCredit += line.creditAmount || 0;

        const categoryLabel = line.journalEntry?.journalSource === 'Cash Out'
          ? resolveExpenseCategoryName(cashOutMap.get(line.journalEntry?.sourceId), 'Cash Out')
          : line.journalEntry?.journalSource || 'Other';
        const contribution = Number(line.debitAmount || 0) - Number(line.creditAmount || 0);

        if (!detailMap[line.chartOfAccountId]) {
          detailMap[line.chartOfAccountId] = {};
        }
        detailMap[line.chartOfAccountId][categoryLabel] = (detailMap[line.chartOfAccountId][categoryLabel] || 0) + contribution;
      }

      const revenueRows = [];
      const cogsRows = [];
      const operatingExpenseRows = [];

      for (const a of accounts) {
        const agg = aggMap[a.id];
        if (!agg) continue;
        const amount = a.accountType === 'Revenue'
          ? agg.totalCredit - agg.totalDebit
          : agg.totalDebit - agg.totalCredit;
        const detailEntries = Object.entries(detailMap[a.id] || {})
          .filter(([, value]) => Math.abs(Number(value || 0)) > 0.009)
          .map(([label, value]) => ({ label, amount: Number(value || 0) }))
          .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount));
        const row = {
          id: a.id,
          accountCode: a.accountCode,
          accountName: a.accountName,
          accountType: a.accountType,
          amount,
          details: a.accountType === 'Expense' ? detailEntries : [],
        };

        if (a.accountType === 'Revenue') {
          revenueRows.push(row);
        } else if (isCogsAccount(a)) {
          cogsRows.push(row);
        } else {
          operatingExpenseRows.push(row);
        }
      }

      const totalRevenue = revenueRows.reduce((sum, row) => sum + row.amount, 0);
      const totalCogs = cogsRows.reduce((sum, row) => sum + row.amount, 0);
      const grossProfit = totalRevenue - totalCogs;
      const totalOperatingExpenses = operatingExpenseRows.reduce((sum, row) => sum + row.amount, 0);
      const totalExpenses = totalCogs + totalOperatingExpenses;
      const netProfit = grossProfit - totalOperatingExpenses;

      return NextResponse.json({
        revenueRows,
        cogsRows,
        operatingExpenseRows,
        expenseRows: operatingExpenseRows,
        totalRevenue,
        totalCogs,
        grossProfit,
        totalOperatingExpenses,
        totalExpenses,
        netProfit,
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

      const inventoryValuation = await inventoryValuationService.buildReport();
      const finishedGoodsInventoryRow = assetRows.find((row) => isFinishedGoodsInventoryAccount(row));
      if (finishedGoodsInventoryRow) {
        finishedGoodsInventoryRow.balance = inventoryValuation.totalInventoryValue;
      }
      const rawMaterialInventoryRow = assetRows.find((row) => {
        const accountCode = String(row.accountCode || '').trim();
        const accountName = String(row.accountName || '').trim().toLowerCase();
        return accountCode === '1400' || accountName.includes('raw material inventory');
      });
      if (rawMaterialInventoryRow) {
        rawMaterialInventoryRow.balance = inventoryValuation.rawMaterialInventoryValue;
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
        inventoryValuation: inventoryValuation.totalInventoryValue,
        isBalanced: difference < 0.01,
        difference,
      });
    }

    if (segs[0] === 'products' && method === 'GET' && segs.length === 1) {
      const url = new URL(request.url);
      const summary = String(url.searchParams.get('summary') || '').trim().toLowerCase();
      if (summary === 'basic') {
        const docs = await prisma.product.findMany({
          where: {
            status: 'Active',
          },
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            status: true,
            costPrice: true,
          },
          orderBy: { name: 'asc' },
        });
        return NextResponse.json(docs);
      }
    }

    // ---------- PRODUCTS — special POST: create inventory rows during product lifecycle ----------
    if (segs[0] === 'products' && method === 'POST' && segs.length === 1) {
      const body = await readJson(request);
      const productId = uuid();
      const systemSettings = await getSystemSettingsMap(prisma);
      const defaultThreshold = readNumberSetting(systemSettings.default_minimum_stock_threshold, 5);

      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({ data: { id: productId, ...body } });
        await ensureInventoryRowsForProduct(tx, {
          productId: created.id,
          colors: created.colors,
          sizes: created.sizes,
          threshold: Math.trunc(defaultThreshold),
        });
        return created;
      });

      invalidateCacheByPrefix('master:commerce-categories:');
      return NextResponse.json(product);
    }

    // ---------- PRODUCTS — special PUT: add only missing inventory rows for new colors or sizes ----------
    if (segs[0] === 'products' && method === 'PUT' && segs.length === 2) {
      const body = await readJson(request);
      const systemSettings = await getSystemSettingsMap(prisma);
      const defaultThreshold = readNumberSetting(systemSettings.default_minimum_stock_threshold, 5);
      const updatedProduct = await prisma.product.update({
        where: { id: segs[1] },
        data: body,
      });

      await ensureInventoryRowsForProduct(prisma, {
        productId: updatedProduct.id,
        colors: updatedProduct.colors,
        sizes: updatedProduct.sizes,
        threshold: Math.trunc(defaultThreshold),
      });

      invalidateCacheByPrefix('master:commerce-categories:');
      return NextResponse.json(updatedProduct);
    }

    // ---------- PRODUCTS — repair-inventory: maintenance-only, idempotent and concurrency-safe ----------
    if (segs[0] === 'products' && segs[1] === 'repair-inventory' && method === 'POST') {
      const products = await prisma.product.findMany({
        select: {
          id: true,
          colors: true,
          sizes: true,
        },
      });
      const systemSettings = await getSystemSettingsMap(prisma);
      const defaultThreshold = readNumberSetting(systemSettings.default_minimum_stock_threshold, 5);

      const result = await repairAllProductInventoryRows(prisma, {
        products,
        threshold: Math.trunc(defaultThreshold),
      });
      return NextResponse.json(result);
    }

    // ---------- INVENTORY POST — blocked to keep inventory generation inside the product lifecycle ----------
    if (segs[0] === 'inventory' && method === 'POST' && segs.length === 1) {
      return NextResponse.json({
        error: 'Inventory rows are created only through product create, product update, or the manual repair inventory maintenance endpoint.',
      }, { status: 405 });
    }

    // ---------- INVENTORY PUT — manual quantity adjustments must always create a movement ----------
    if (segs[0] === 'inventory' && method === 'PUT' && segs.length === 2) {
      const id = segs[1];
      const body = await readJson(request);
      const systemSettings = await getSystemSettingsMap(prisma);
      const allowManualAdjustment = readBooleanSetting(systemSettings.allow_manual_adjustment, true);
      const allowNegativeStock = readBooleanSetting(systemSettings.enable_negative_stock, false);
      if (!allowManualAdjustment) {
        return NextResponse.json({ error: 'Manual inventory adjustment is currently disabled in system configuration.' }, { status: 403 });
      }

      const current = await prisma.inventory.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });

      const nextQuantity = body.quantity !== undefined ? Number(body.quantity) : current.quantity;
      if (!Number.isFinite(nextQuantity)) {
        return NextResponse.json({ error: 'Inventory quantity is invalid.' }, { status: 400 });
      }
      if (!allowNegativeStock && nextQuantity < 0) {
        return NextResponse.json({ error: 'Inventory quantity cannot be negative.' }, { status: 400 });
      }

      const inventoryData = {};
      if (body.threshold !== undefined) inventoryData.threshold = Number(body.threshold);
      if (body.incoming !== undefined) inventoryData.incoming = Number(body.incoming);
      if (body.status !== undefined) inventoryData.status = body.status;

      const referenceNumber = await generateStockMovementRef(new Date().toISOString().split('T')[0]);
      const result = await inventoryMovementService.updateInventoryQuantity({
        inventoryId: id,
        nextQuantity,
        movementType: INVENTORY_MOVEMENT_TYPE.MANUAL_ADJUSTMENT,
        referenceType: INVENTORY_REFERENCE_TYPE.INVENTORY,
        referenceId: id,
        referenceNumber,
        performedBy: String(body.performedBy || body.updatedBy || INVENTORY_PERFORMED_BY.SYSTEM),
        notes: String(body.reason || body.notes || 'Manual inventory adjustment'),
        inventoryData,
      });

      await writeAuditLog({
        prismaClient: prisma,
        user: authContext?.user,
        module: 'INVENTORY',
        action: 'MANUAL_INVENTORY_ADJUSTMENT',
        description: `Manual inventory adjustment recorded for inventory ${id}.`,
        metadata: { inventoryId: id, previousQuantity: current.quantity, newQuantity: nextQuantity },
      });

      await notificationService.dispatch({
        type: 'MANUAL_STOCK_ADJUSTMENT',
        payload: {
          inventoryId: id,
          referenceId: id,
          productName: result.inventory?.product?.name || '',
        },
        prismaClient: prisma,
      });

      if (Number(result.inventory?.quantity || 0) <= Number(result.inventory?.threshold || 0)) {
        await notificationService.dispatch({
          type: Number(result.inventory?.quantity || 0) <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
          payload: {
            inventoryId: id,
            referenceId: id,
            quantity: result.inventory?.quantity || 0,
            productName: result.inventory?.product?.name || '',
          },
          prismaClient: prisma,
        });
      }

      return NextResponse.json(result.inventory);
    }

    // ---------- STOCK MOVEMENTS ----------
    if (segs[0] === 'stockmovements') {
      // Stats
      if (segs[1] === 'stats' && method === 'GET') {
        const url = new URL(request.url);
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const type = url.searchParams.get('type');
        const where = {};
        if (from || to) { where.movementDate = {}; if (from) where.movementDate.gte = from; if (to) where.movementDate.lte = to; }
        if (type) where.movementType = type;
        // Raw Materials are master data — always exclude their movements from the inventory timeline
        where.itemType = { not: 'RAW_MATERIAL' };
        const movements = await prisma.stockMovement.findMany({
          where,
          select: {
            movementType: true,
            quantityChanged: true,
            quantity: true,
            previousQuantity: true,
            newQuantity: true,
          },
        });
        const totalMovements = movements.length;
        const inTypes = ['ADJUSTMENT_IN', 'MANUAL_IN', 'OPENING', 'PRODUCTION_IN', 'PRODUCTION_RESULT', 'INITIAL_STOCK'];
        const outTypes = ['ADJUSTMENT_OUT', 'MANUAL_OUT', 'PRODUCTION_OUT', 'SALE'];
        const resolveQuantityChanged = (movement) => Number(movement.quantityChanged || movement.quantity || 0);
        const isInboundMovement = (movement) => {
          if (movement.movementType === INVENTORY_MOVEMENT_TYPE.MANUAL_ADJUSTMENT || movement.movementType === INVENTORY_MOVEMENT_TYPE.STOCK_OPNAME) {
            return Number(movement.newQuantity || 0) > Number(movement.previousQuantity || 0);
          }
          return inTypes.includes(movement.movementType);
        };
        const isOutboundMovement = (movement) => {
          if (movement.movementType === INVENTORY_MOVEMENT_TYPE.MANUAL_ADJUSTMENT || movement.movementType === INVENTORY_MOVEMENT_TYPE.STOCK_OPNAME) {
            return Number(movement.newQuantity || 0) < Number(movement.previousQuantity || 0);
          }
          return outTypes.includes(movement.movementType);
        };
        const totalIn = movements.filter(isInboundMovement).reduce((sum, movement) => sum + resolveQuantityChanged(movement), 0);
        const totalOut = movements.filter(isOutboundMovement).reduce((sum, movement) => sum + resolveQuantityChanged(movement), 0);
        const adjustmentMovements = movements.filter((movement) => (
          movement.movementType === INVENTORY_MOVEMENT_TYPE.MANUAL_ADJUSTMENT
          || movement.movementType === 'ADJUSTMENT_IN'
          || movement.movementType === 'ADJUSTMENT_OUT'
          || movement.movementType === 'MANUAL_IN'
          || movement.movementType === 'MANUAL_OUT'
          || movement.movementType === 'OPENING'
          || movement.movementType === 'INITIAL_STOCK'
        )).length;
        const productionMovements = movements.filter((movement) => ['PRODUCTION_IN', 'PRODUCTION_OUT', 'PRODUCTION_RESULT'].includes(movement.movementType)).length;
        return NextResponse.json({ totalMovements, totalIn, totalOut, adjustmentMovements, productionMovements });
      }

      // List
      if (method === 'GET' && segs.length === 1) {
        const url = new URL(request.url);
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        const type = url.searchParams.get('type');
        const search = url.searchParams.get('search');
        const where = {};
        if (from || to) { where.movementDate = {}; if (from) where.movementDate.gte = from; if (to) where.movementDate.lte = to; }
        if (type) where.movementType = type;
        // Raw Materials are master data — always exclude their movements from the inventory timeline.
        // Historical records remain in the database but are not surfaced in the UI.
        where.itemType = { not: 'RAW_MATERIAL' };
        const movements = await prisma.stockMovement.findMany({
          where,
          include: {
            product: { select: { id: true, name: true, sku: true } },
            inventory: { select: { color: true, size: true } },
          },
          orderBy: [{ movementDate: 'desc' }, { createdAt: 'desc' }],
        });
        const result = search
          ? movements.filter(m => {
              const s = search.toLowerCase();
              return (m.product?.name || '').toLowerCase().includes(s)
                || (m.product?.sku || '').toLowerCase().includes(s)
                || (m.referenceNumber || '').toLowerCase().includes(s);
            })
          : movements;
        return NextResponse.json(result);
      }

      // Manual adjustment POST
      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        const systemSettings = await getSystemSettingsMap(prisma);
        const allowManualInventory = readBooleanSetting(systemSettings.enable_manual_inventory, true);
        const allowNegativeStock = readBooleanSetting(systemSettings.enable_negative_stock, false);
        if (!allowManualInventory) {
          return NextResponse.json({ error: 'Manual inventory workflow is currently disabled in system configuration.' }, { status: 403 });
        }
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
            if (!allowNegativeStock && newQty < 0) return NextResponse.json({ error: `Insufficient stock. Current: ${prevQty}, Requested: ${qty}` }, { status: 400 });
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
                quantityChanged: qty,
                previousQuantity: prevQty,
                newQuantity: newQty,
                notes: body.notes || '',
                referenceType: INVENTORY_REFERENCE_TYPE.RAW_MATERIAL,
                referenceId: body.rawMaterialId,
                referenceNumber: ref,
                performedBy: String(body.createdBy || INVENTORY_PERFORMED_BY.SYSTEM),
              },
            }),
            prisma.rawMaterial.update({ where: { id: body.rawMaterialId }, data: { currentStock: newQty } }),
          ]);
          await writeAuditLog({
            prismaClient: prisma,
            user: authContext?.user,
            module: 'INVENTORY',
            action: 'MANUAL_INVENTORY_ADJUSTMENT',
            description: `Manual raw material movement ${body.movementType} recorded for ${body.rawMaterialId}.`,
            metadata: { rawMaterialId: body.rawMaterialId, movementId: movement.id, quantity: qty },
          });
          await notificationService.dispatch({
            type: 'MANUAL_STOCK_ADJUSTMENT',
            payload: {
              referenceId: body.rawMaterialId,
              referenceLabel: rm.name,
            },
            prismaClient: prisma,
          });
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
          if (!allowNegativeStock && newQty < 0) return NextResponse.json({ error: `Insufficient stock. Current: ${prevQty}, Requested: ${qty}` }, { status: 400 });
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
              color: inv.color,
              size: inv.size,
              movementDate,
              movementType: body.movementType,
              quantity: qty,
              quantityChanged: qty,
              previousQuantity: prevQty,
              newQuantity: newQty,
              notes: body.notes || 'Manual inventory adjustment',
              referenceType: INVENTORY_REFERENCE_TYPE.MANUAL,
              referenceId: body.inventoryId,
              referenceNumber: ref,
              performedBy: String(body.createdBy || INVENTORY_PERFORMED_BY.SYSTEM),
            },
          }),
          prisma.inventory.update({ where: { id: body.inventoryId }, data: { quantity: newQty } }),
        ]);
        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'INVENTORY',
          action: 'MANUAL_INVENTORY_ADJUSTMENT',
          description: `Manual inventory movement ${body.movementType} recorded for inventory ${body.inventoryId}.`,
          metadata: { inventoryId: body.inventoryId, movementId: movement.id, quantity: qty },
        });
        await notificationService.dispatch({
          type: 'MANUAL_STOCK_ADJUSTMENT',
          payload: {
            inventoryId: body.inventoryId,
            referenceId: body.inventoryId,
            referenceLabel: `${inv.productId} ${inv.color}/${inv.size}`,
          },
          prismaClient: prisma,
        });
        if (newQty <= Number(inv.threshold || 0)) {
          await notificationService.dispatch({
            type: newQty <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
            payload: {
              inventoryId: body.inventoryId,
              referenceId: body.inventoryId,
              quantity: newQty,
              referenceLabel: `${inv.productId} ${inv.color}/${inv.size}`,
            },
            prismaClient: prisma,
          });
        }
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

    // ---------- CONTENT PLANNER ----------
    if (segs[0] === 'content') {
      if (method === 'GET' && segs.length === 1) {
        await dispatchDueContentReminders(prisma);
        const url = new URL(request.url);
        const month = String(url.searchParams.get('month') || '').trim();
        const search = String(url.searchParams.get('search') || '').trim();
        const status = String(url.searchParams.get('status') || '').trim();
        const platform = String(url.searchParams.get('platform') || '').trim();
        const assignedUserId = String(url.searchParams.get('assignedUserId') || '').trim();
        const category = String(url.searchParams.get('category') || '').trim();
        const priority = String(url.searchParams.get('priority') || '').trim();

        const where = {};
        if (month) {
          where.publishDate = { startsWith: month };
        }
        if (status && status !== 'all') {
          where.status = status;
        }
        if (platform && platform !== 'all') {
          where.platforms = { has: platform };
        }
        if (assignedUserId && assignedUserId !== 'all') {
          where.assignedUserId = assignedUserId;
        }
        if (category && category !== 'all') {
          where.category = category;
        }
        if (priority && priority !== 'all') {
          where.priority = priority;
        }
        if (search) {
          where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { contentBriefRichText: { contains: search, mode: 'insensitive' } },
            { scriptRichText: { contains: search, mode: 'insensitive' } },
            { captionRichText: { contains: search, mode: 'insensitive' } },
          ];
        }

        const [items, users] = await Promise.all([
          prisma.contentPlanner.findMany({
            where,
            select: {
              id: true,
              title: true,
              platforms: true,
              category: true,
              priority: true,
              status: true,
              assignedUserId: true,
              assignedUserName: true,
              publishDate: true,
              publishTime: true,
              reminderDate: true,
            },
            orderBy: [
              { publishDate: 'asc' },
              { publishTime: 'asc' },
              { title: 'asc' },
            ],
          }),
          prisma.user.findMany({
            where: { status: 'Active' },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          }),
        ]);

        return NextResponse.json({
          month,
          summary: normalizeContentPlannerSummary(items),
          users,
          data: items,
        });
      }

      if (method === 'GET' && segs.length === 2) {
        await dispatchDueContentReminders(prisma);
        const planner = await prisma.contentPlanner.findUnique({
          where: { id: segs[1] },
          include: {
            checklists: { orderBy: { sortOrder: 'asc' } },
            assets: { orderBy: { sortOrder: 'asc' } },
            comments: { orderBy: { createdAt: 'asc' } },
          },
        });
        if (!planner) return NextResponse.json({ error: 'Content planner item not found.' }, { status: 404 });
        return NextResponse.json(planner);
      }

      if (method === 'POST' && segs.length === 1) {
        const body = await readJson(request);
        const title = String(body.title || '').trim();
        if (!title) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
        if (!Array.isArray(body.platforms) || body.platforms.length === 0) {
          return NextResponse.json({ error: 'At least one platform is required.' }, { status: 400 });
        }
        if (!String(body.publishDate || '').trim()) {
          return NextResponse.json({ error: 'Publish date is required.' }, { status: 400 });
        }

        let assignedUserName = String(body.assignedUserName || '').trim();
        if (body.assignedUserId) {
          const assignedUser = await prisma.user.findUnique({ where: { id: body.assignedUserId }, select: { id: true, name: true } });
          assignedUserName = assignedUser?.name || assignedUserName;
        }

        const planner = await prisma.contentPlanner.create({
          data: {
            id: uuid(),
            title,
            platforms: Array.isArray(body.platforms) ? body.platforms.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
            category: String(body.category || 'Product').trim() || 'Product',
            priority: String(body.priority || 'Medium').trim() || 'Medium',
            status: String(body.status || 'Draft').trim() || 'Draft',
            assignedUserId: String(body.assignedUserId || '').trim(),
            assignedUserName,
            publishDate: String(body.publishDate || '').trim(),
            publishTime: String(body.publishTime || '').trim(),
            reminderDate: String(body.reminderDate || '').trim(),
            contentBriefRichText: String(body.contentBriefRichText || ''),
            scriptRichText: String(body.scriptRichText || ''),
            captionRichText: String(body.captionRichText || ''),
            ctaText: String(body.ctaText || ''),
            hashtags: Array.isArray(body.hashtags) ? body.hashtags.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
            notesRichText: String(body.notesRichText || ''),
            checklists: {
              create: Array.isArray(body.checklists) ? body.checklists.map((item, index) => ({
                id: uuid(),
                label: String(item.label || '').trim(),
                isCompleted: Boolean(item.isCompleted),
                sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
              })).filter((item) => item.label) : [],
            },
            assets: {
              create: Array.isArray(body.assets) ? body.assets.map((item, index) => ({
                id: uuid(),
                assetType: String(item.assetType || 'Asset').trim() || 'Asset',
                name: String(item.name || '').trim(),
                url: String(item.url || '').trim(),
                mimeType: String(item.mimeType || '').trim(),
                sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
              })).filter((item) => item.url) : [],
            },
          },
          include: {
            checklists: { orderBy: { sortOrder: 'asc' } },
            assets: { orderBy: { sortOrder: 'asc' } },
            comments: { orderBy: { createdAt: 'asc' } },
          },
        });

        await dispatchDueContentReminders(prisma);
        return NextResponse.json(planner);
      }

      if (method === 'PUT' && segs.length === 2) {
        const body = await readJson(request);
        const existingPlanner = await prisma.contentPlanner.findUnique({
          where: { id: segs[1] },
          include: {
            checklists: true,
            assets: true,
            comments: true,
          },
        });
        if (!existingPlanner) return NextResponse.json({ error: 'Content planner item not found.' }, { status: 404 });

        let assignedUserName = body.assignedUserName !== undefined ? String(body.assignedUserName || '').trim() : existingPlanner.assignedUserName;
        if (body.assignedUserId !== undefined && String(body.assignedUserId || '').trim()) {
          const assignedUser = await prisma.user.findUnique({ where: { id: body.assignedUserId }, select: { id: true, name: true } });
          assignedUserName = assignedUser?.name || assignedUserName;
        }

        const updated = await prisma.$transaction(async (tx) => {
          await tx.contentPlanner.update({
            where: { id: segs[1] },
            data: {
              title: body.title !== undefined ? String(body.title || '').trim() : existingPlanner.title,
              platforms: Array.isArray(body.platforms) ? body.platforms.map((entry) => String(entry || '').trim()).filter(Boolean) : existingPlanner.platforms,
              category: body.category !== undefined ? String(body.category || '').trim() || 'Product' : existingPlanner.category,
              priority: body.priority !== undefined ? String(body.priority || '').trim() || 'Medium' : existingPlanner.priority,
              status: body.status !== undefined ? String(body.status || '').trim() || 'Draft' : existingPlanner.status,
              assignedUserId: body.assignedUserId !== undefined ? String(body.assignedUserId || '').trim() : existingPlanner.assignedUserId,
              assignedUserName,
              publishDate: body.publishDate !== undefined ? String(body.publishDate || '').trim() : existingPlanner.publishDate,
              publishTime: body.publishTime !== undefined ? String(body.publishTime || '').trim() : existingPlanner.publishTime,
              reminderDate: body.reminderDate !== undefined ? String(body.reminderDate || '').trim() : existingPlanner.reminderDate,
              reminderNotifiedAt: body.reminderDate !== undefined ? null : existingPlanner.reminderNotifiedAt,
              contentBriefRichText: body.contentBriefRichText !== undefined ? String(body.contentBriefRichText || '') : existingPlanner.contentBriefRichText,
              scriptRichText: body.scriptRichText !== undefined ? String(body.scriptRichText || '') : existingPlanner.scriptRichText,
              captionRichText: body.captionRichText !== undefined ? String(body.captionRichText || '') : existingPlanner.captionRichText,
              ctaText: body.ctaText !== undefined ? String(body.ctaText || '') : existingPlanner.ctaText,
              hashtags: Array.isArray(body.hashtags) ? body.hashtags.map((entry) => String(entry || '').trim()).filter(Boolean) : existingPlanner.hashtags,
              notesRichText: body.notesRichText !== undefined ? String(body.notesRichText || '') : existingPlanner.notesRichText,
            },
          });

          if (Array.isArray(body.checklists)) {
            await tx.contentChecklist.deleteMany({ where: { contentPlannerId: segs[1] } });
            const checklistRows = body.checklists
              .map((item, index) => ({
                id: uuid(),
                contentPlannerId: segs[1],
                label: String(item.label || '').trim(),
                isCompleted: Boolean(item.isCompleted),
                sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
              }))
              .filter((item) => item.label);
            if (checklistRows.length > 0) {
              await tx.contentChecklist.createMany({ data: checklistRows });
            }
          }

          if (Array.isArray(body.assets)) {
            await tx.contentAsset.deleteMany({ where: { contentPlannerId: segs[1] } });
            const assetRows = body.assets
              .map((item, index) => ({
                id: uuid(),
                contentPlannerId: segs[1],
                assetType: String(item.assetType || 'Asset').trim() || 'Asset',
                name: String(item.name || '').trim(),
                url: String(item.url || '').trim(),
                mimeType: String(item.mimeType || '').trim(),
                sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
              }))
              .filter((item) => item.url);
            if (assetRows.length > 0) {
              await tx.contentAsset.createMany({ data: assetRows });
            }
          }

          return tx.contentPlanner.findUnique({
            where: { id: segs[1] },
            include: {
              checklists: { orderBy: { sortOrder: 'asc' } },
              assets: { orderBy: { sortOrder: 'asc' } },
              comments: { orderBy: { createdAt: 'asc' } },
            },
          });
        });

        await dispatchDueContentReminders(prisma);
        return NextResponse.json(updated);
      }

      if (method === 'DELETE' && segs.length === 2) {
        await prisma.contentPlanner.delete({ where: { id: segs[1] } });
        return NextResponse.json({ ok: true });
      }

      if (method === 'POST' && segs.length === 3 && segs[2] === 'comments') {
        const body = await readJson(request);
        const existingPlanner = await prisma.contentPlanner.findUnique({ where: { id: segs[1] }, select: { id: true } });
        if (!existingPlanner) return NextResponse.json({ error: 'Content planner item not found.' }, { status: 404 });
        const comment = String(body.comment || '').trim();
        if (!comment) return NextResponse.json({ error: 'Comment is required.' }, { status: 400 });
        const createdComment = await prisma.contentComment.create({
          data: {
            id: uuid(),
            contentPlannerId: segs[1],
            userId: String(body.userId || '').trim(),
            userName: String(body.userName || 'HQ User').trim() || 'HQ User',
            comment,
          },
        });
        return NextResponse.json(createdComment);
      }
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
        if (modelName === 'financialAccount') invalidateCacheKey(buildMasterDataCacheKey('financialaccounts'));
        if (modelName === 'chartOfAccount') invalidateCacheKey(buildMasterDataCacheKey('chartofaccounts'));
        return NextResponse.json(doc);
      }
      if (method === 'PUT' && segs.length === 2) {
        const body = await readJson(request);
        const id = segs[1];
        const updated = await model.update({ where: { id }, data: body });
        if (modelName === 'financialAccount') invalidateCacheKey(buildMasterDataCacheKey('financialaccounts'));
        if (modelName === 'chartOfAccount') invalidateCacheKey(buildMasterDataCacheKey('chartofaccounts'));
        return NextResponse.json(updated);
      }
      if (method === 'DELETE' && segs.length === 2) {
        const id = segs[1];
        if (modelName === 'chartOfAccount') {
          const updated = await model.update({ where: { id }, data: { isActive: false } });
          invalidateCacheKey(buildMasterDataCacheKey('chartofaccounts'));
          return NextResponse.json(updated);
        }
        if (modelName === 'product') {
          await prisma.inventory.deleteMany({ where: { productId: id } });
        }
        await model.delete({ where: { id } });
        if (modelName === 'financialAccount') invalidateCacheKey(buildMasterDataCacheKey('financialaccounts'));
        if (modelName === 'product') invalidateCacheByPrefix('master:commerce-categories:');
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
        const systemSettings = await getSystemSettingsMap(prisma);
        const productionEnabled = readBooleanSetting(systemSettings.enable_production_workflow, true);
        if (!productionEnabled) {
          return NextResponse.json({ error: 'Production workflow is currently disabled in system configuration.' }, { status: 403 });
        }
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
        const systemSettings = await getSystemSettingsMap(prisma);
        const productionEnabled = readBooleanSetting(systemSettings.enable_production_workflow, true);
        if (!productionEnabled) {
          return NextResponse.json({ error: 'Production workflow is currently disabled in system configuration.' }, { status: 403 });
        }
        const order = await prisma.productionOrder.findUnique({ where: { id: segs[1] } });
        if (!order) return NextResponse.json({ error: 'Production Order not found' }, { status: 404 });
        if (order.status !== 'Ready') return NextResponse.json({ error: `Cannot start — current status is "${order.status}". Only Ready orders can be started.` }, { status: 400 });
        const updated = await prisma.productionOrder.update({
          where: { id: segs[1] },
          data: { status: 'In Production', startedAt: new Date() },
          include: { product: { select: { id: true, name: true, sku: true } }, bom: { select: { id: true, bomCode: true, version: true } } },
        });
        await notificationService.dispatch({
          type: 'PRODUCTION_STARTED',
          payload: {
            productionOrderId: updated.id,
            productionOrderNumber: updated.productionOrderNumber,
            productName: updated.product?.name || '',
          },
          prismaClient: prisma,
        });
        return NextResponse.json(updated);
      }

      // ── Complete Production (POST /productionorders/:id/complete)
      if (method === 'POST' && segs.length === 3 && segs[2] === 'complete') {
        const systemSettings = await getSystemSettingsMap(prisma);
        const productionEnabled = readBooleanSetting(systemSettings.enable_production_workflow, true);
        if (!productionEnabled) {
          return NextResponse.json({ error: 'Production workflow is currently disabled in system configuration.' }, { status: 403 });
        }
        authContext = await requireHqPermission(request, 'production', 'complete', { prismaClient: prisma });
        const body = await readJson(request);
        const actualQty = Number(body.actualQuantity);
        const laborCost = Number(body.laborCost || 0);
        const factoryOverheadCost = Number(body.factoryOverheadCost || 0);
        const otherCost = Number(body.otherCost || 0);

        if (!actualQty || actualQty <= 0) {
          return NextResponse.json({ error: 'Actual quantity must be greater than zero' }, { status: 400 });
        }
        if (laborCost < 0 || factoryOverheadCost < 0 || otherCost < 0) {
          return NextResponse.json({ error: 'Optional production costs cannot be negative' }, { status: 400 });
        }

        const order = await prisma.productionOrder.findUnique({
          where: { id: segs[1] },
          include: {
            product: { select: { id: true, name: true, sku: true, costPrice: true } },
            bom: { include: { items: { include: { rawMaterial: true } } } },
          },
        });
        if (!order) return NextResponse.json({ error: 'Production Order not found' }, { status: 404 });
        if (order.status !== 'In Production') return NextResponse.json({ error: `Cannot complete — current status is "${order.status}". Order must be In Production.` }, { status: 400 });

        const materialConsumptions = order.bom.items.map((item) => {
          const consumedQuantity = Number(item.quantityRequired || 0) * actualQty;
          const materialUnitCost = Number(item.rawMaterial?.unitCost || 0);
          return {
            item,
            consumedQuantity,
            materialUnitCost,
            materialCost: consumedQuantity * materialUnitCost,
          };
        });

        for (const consumption of materialConsumptions) {
          if ((consumption.item.rawMaterial.currentStock ?? 0) < consumption.consumedQuantity) {
            return NextResponse.json({ error: `Insufficient stock for "${consumption.item.rawMaterial.name}". Need ${consumption.consumedQuantity}, have ${consumption.item.rawMaterial.currentStock ?? 0}.` }, { status: 400 });
          }
        }

        const totalMaterialCost = materialConsumptions.reduce((sum, consumption) => sum + consumption.materialCost, 0);
        const totalProductionCost = totalMaterialCost + laborCost + factoryOverheadCost + otherCost;
        const unitProductionCost = totalProductionCost > 0 ? totalProductionCost / actualQty : 0;
        const now = new Date();
        const movDate = now.toISOString().split('T')[0];

        let createdResultNumber = '';
        const completedOrder = await prisma.$transaction(async (tx) => {
          const resultNumber = await generateProductionResultNumber(tx, now);
          createdResultNumber = resultNumber;
          const inventoryEntries = await tx.inventory.findMany({ where: { productId: order.productId }, orderBy: { id: 'asc' } });
          if (inventoryEntries.length === 0) {
            throw new Error('Inventory rows are missing for this product. Run the manual repair inventory maintenance endpoint before completing production.');
          }

          const targetInventory = inventoryEntries[0];
          const existingTotalQty = inventoryEntries.reduce((sum, inventory) => sum + Number(inventory.quantity || 0), 0);
          const existingAverageCost = Number(order.product?.costPrice || targetInventory.averageCost || 0);
          const newTotalQty = existingTotalQty + actualQty;
          const newAverageCost = newTotalQty > 0
            ? (((existingTotalQty * existingAverageCost) + (actualQty * unitProductionCost)) / newTotalQty)
            : unitProductionCost;

          for (const consumption of materialConsumptions) {
            const previousQuantity = Number(consumption.item.rawMaterial.currentStock ?? 0);
            const newQuantity = previousQuantity - consumption.consumedQuantity;
            await tx.rawMaterial.update({
              where: { id: consumption.item.rawMaterialId },
              data: { currentStock: newQuantity },
            });
            await tx.stockMovement.create({
              data: {
                id: uuid(),
                itemType: 'RAW_MATERIAL',
                rawMaterialId: consumption.item.rawMaterialId,
                movementDate: movDate,
                movementType: 'PRODUCTION_OUT',
                quantity: consumption.consumedQuantity,
                quantityChanged: consumption.consumedQuantity,
                previousQuantity,
                newQuantity,
                referenceType: INVENTORY_REFERENCE_TYPE.PRODUCTION_ORDER,
                referenceId: order.id,
                referenceNumber: resultNumber,
                performedBy: INVENTORY_PERFORMED_BY.SYSTEM,
                notes: `Production Result ${resultNumber} · Consumed ${consumption.consumedQuantity.toLocaleString('id-ID')} ${consumption.item.rawMaterial.unit || ''}`.trim(),
              },
            });
          }

          await tx.inventory.update({
            where: { id: targetInventory.id },
            data: {
              quantity: Number(targetInventory.quantity || 0) + actualQty,
              averageCost: newAverageCost,
            },
          });
          await tx.inventory.updateMany({
            where: { productId: order.productId },
            data: { averageCost: newAverageCost },
          });
          await tx.product.update({
            where: { id: order.productId },
            data: { costPrice: newAverageCost },
          });

          await tx.stockMovement.create({
            data: {
              id: uuid(),
              itemType: 'PRODUCT',
              productId: order.productId,
              inventoryId: targetInventory.id,
              color: targetInventory.color,
              size: targetInventory.size,
              movementDate: movDate,
              movementType: INVENTORY_MOVEMENT_TYPE.PRODUCTION_RESULT,
              quantity: actualQty,
              quantityChanged: actualQty,
              previousQuantity: Number(targetInventory.quantity || 0),
              newQuantity: Number(targetInventory.quantity || 0) + actualQty,
              referenceType: INVENTORY_REFERENCE_TYPE.PRODUCTION_ORDER,
              referenceId: order.id,
              referenceNumber: resultNumber,
              performedBy: INVENTORY_PERFORMED_BY.SYSTEM,
              notes: `Production Result ${resultNumber} · Produced ${actualQty.toLocaleString('id-ID')} pcs`,
            },
          });

          const updatedOrder = await tx.productionOrder.update({
            where: { id: segs[1] },
            data: {
              status: 'Completed',
              actualQuantity: actualQty,
              completedAt: now,
              notes: body.completionNotes ? (order.notes ? `${order.notes}\n${body.completionNotes}` : body.completionNotes) : order.notes,
            },
            include: {
              product: { select: { id: true, name: true, sku: true, costPrice: true } },
              bom: { select: { id: true, bomCode: true, version: true } },
            },
          });

          const createdResult = await tx.productionResult.create({
            data: {
              id: uuid(),
              resultNumber,
              productionOrderId: segs[1],
              totalMaterialCost,
              laborCost,
              factoryOverheadCost,
              otherCost,
              totalProductionCost,
              unitProductionCost,
            },
            include: {
              productionOrder: {
                include: {
                  product: { select: { id: true, name: true, sku: true, costPrice: true } },
                  bom: { select: { id: true, bomCode: true, version: true } },
                },
              },
            },
          });

          await financePostingService.postProductionResultJournal(createdResult, { prismaClient: tx });
          return updatedOrder;
        });

        await writeAuditLog({
          prismaClient: prisma,
          user: authContext?.user,
          module: 'PRODUCTION',
          action: 'PRODUCTION_RESULT_POSTED',
          description: `Production result ${createdResultNumber} was completed for order ${completedOrder.productionOrderNumber}.`,
          metadata: { productionOrderId: completedOrder.id, resultNumber: createdResultNumber, actualQuantity: actualQty, totalProductionCost },
        });

        await notificationService.dispatch({
          type: 'PRODUCTION_FINISHED',
          payload: {
            productionResultId: completedOrder.productionResult?.id || '',
            productionOrderId: completedOrder.id,
            resultNumber: createdResultNumber,
            actualQuantity: actualQty,
            productName: completedOrder.product?.name || '',
          },
          prismaClient: prisma,
        });

        return NextResponse.json(completedOrder);
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
            referenceNumber: { in: [result.resultNumber, result.productionOrder.productionOrderNumber] },
            movementType: { in: ['PRODUCTION_RESULT', 'PRODUCTION_IN', 'PRODUCTION_OUT'] },
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
        const stats = await getCachedValue(buildMasterDataCacheKey('saleschannels', 'stats'), MASTER_DATA_CACHE_TTL_MS, async () => {
          const all = await prisma.salesChannel.findMany({ select: { status: true } });
          const total = all.length;
          const active = all.filter(c => c.status === 'Active').length;
          const inactive = all.filter(c => c.status === 'Inactive').length;
          return { total, active, inactive };
        });
        return NextResponse.json(stats);
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
        invalidateCacheByPrefix(buildMasterDataCacheKey('saleschannels', ''));
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
        const cacheKey = buildMasterDataCacheKey('saleschannels', `${status || 'all'}:${channelType || 'all'}:${String(search || '').trim().toLowerCase()}`);
        const result = await getCachedValue(cacheKey, MASTER_DATA_CACHE_TTL_MS, async () => {
          const channels = await prisma.salesChannel.findMany({
            where,
            orderBy: { channelCode: 'asc' },
          });
          return search
            ? channels.filter(c => {
                const q = search.toLowerCase();
                return c.channelCode.toLowerCase().includes(q)
                  || c.channelName.toLowerCase().includes(q)
                  || c.channelType.toLowerCase().includes(q);
              })
            : channels;
        });
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
        invalidateCacheByPrefix(buildMasterDataCacheKey('saleschannels', ''));
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
        invalidateCacheByPrefix(buildMasterDataCacheKey('saleschannels', ''));
        return NextResponse.json(updated);
      }

      // Soft delete (set Inactive)
      if (method === 'DELETE' && segs.length === 2) {
        const updated = await prisma.salesChannel.update({ where: { id: segs[1] }, data: { status: 'Inactive' } });
        invalidateCacheByPrefix(buildMasterDataCacheKey('saleschannels', ''));
        return NextResponse.json(updated);
      }
    }


    // ─────────── CUSTOMERS ───────────
    if (segs[0] === 'customers') {
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
          const customerCode = await generateCustomerCode(prisma);
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

        const customerCode = await generateCustomerCode(prisma);
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
    if (e instanceof HqSecurityError) {
      return buildHqSecurityErrorResponse(e);
    }

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
    return NextResponse.json({ error: 'The request could not be completed. Please try again.' }, { status: 500 });
  } finally {
    if (process.env.NODE_ENV === 'development') {
      const pathname = new URL(request.url).pathname;
      console.info(`${method} ${pathname} Response Time: ${Date.now() - startedAt} ms`);
    }
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
