import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const HQ_SESSION_COOKIE_NAME = 'om_hq_session';
const PASSWORD_HASH_ROUNDS = 12;
const DEFAULT_LOCKOUT_MINUTES = 30;

export const HQ_PERMISSION_CATALOG = [
  {
    moduleKey: 'dashboard',
    label: 'Dashboard',
    actions: [{ key: 'view', label: 'View' }],
  },
  {
    moduleKey: 'operations',
    label: 'Operations',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'update', label: 'Update' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    moduleKey: 'inventory',
    label: 'Inventory',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'adjustment', label: 'Adjustment' },
      { key: 'manual_stock', label: 'Manual Stock' },
    ],
  },
  {
    moduleKey: 'production',
    label: 'Production',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'update', label: 'Update' },
      { key: 'complete', label: 'Complete Production' },
    ],
  },
  {
    moduleKey: 'sales',
    label: 'Sales',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'manage_master', label: 'Manage Master Data' },
      { key: 'update_order', label: 'Update Order' },
      { key: 'fulfillment', label: 'Fulfillment' },
    ],
  },
  {
    moduleKey: 'finance',
    label: 'Finance',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'cash_in', label: 'Cash In' },
      { key: 'cash_out', label: 'Cash Out' },
      { key: 'journal', label: 'Journal' },
      { key: 'manage_accounts', label: 'Manage Accounts' },
    ],
  },
  {
    moduleKey: 'marketing',
    label: 'Marketing',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'create', label: 'Create' },
      { key: 'update', label: 'Update' },
      { key: 'delete', label: 'Delete' },
    ],
  },
  {
    moduleKey: 'reports',
    label: 'Reports',
    actions: [{ key: 'view', label: 'View' }],
  },
  {
    moduleKey: 'settings',
    label: 'Settings',
    actions: [
      { key: 'view', label: 'View' },
      { key: 'manage_users', label: 'Manage Users' },
      { key: 'manage_roles', label: 'Manage Roles' },
      { key: 'manage_notifications', label: 'Manage Notifications' },
      { key: 'manage_configuration', label: 'Manage Configuration' },
      { key: 'view_audit', label: 'View Audit Log' },
    ],
  },
];

const DEFAULT_ROLE_BLUEPRINTS = [
  {
    name: 'Super Admin',
    description: 'Full access to all ERP modules and settings.',
    status: 'Active',
    isSystem: true,
    allowAll: true,
  },
  {
    name: 'Admin',
    description: 'General administration access across daily ERP operations.',
    status: 'Active',
    isSystem: true,
    permissions: [
      'dashboard:view',
      'operations:view',
      'operations:create',
      'operations:update',
      'inventory:view',
      'inventory:adjustment',
      'inventory:manual_stock',
      'production:view',
      'production:create',
      'production:update',
      'production:complete',
      'sales:view',
      'sales:manage_master',
      'sales:update_order',
      'sales:fulfillment',
      'finance:view',
      'finance:cash_in',
      'finance:cash_out',
      'finance:journal',
      'finance:manage_accounts',
      'marketing:view',
      'marketing:create',
      'marketing:update',
      'reports:view',
      'settings:view',
      'settings:manage_users',
      'settings:manage_roles',
      'settings:manage_notifications',
      'settings:manage_configuration',
      'settings:view_audit',
    ],
  },
  {
    name: 'Finance',
    description: 'Handles cash, journals, reports, and financial reviews.',
    status: 'Active',
    isSystem: true,
    permissions: [
      'dashboard:view',
      'finance:view',
      'finance:cash_in',
      'finance:cash_out',
      'finance:journal',
      'finance:manage_accounts',
      'reports:view',
      'sales:view',
    ],
  },
  {
    name: 'Operations',
    description: 'Manages inventory, production, products, and fulfillment.',
    status: 'Active',
    isSystem: true,
    permissions: [
      'dashboard:view',
      'operations:view',
      'operations:create',
      'operations:update',
      'inventory:view',
      'inventory:adjustment',
      'inventory:manual_stock',
      'production:view',
      'production:create',
      'production:update',
      'production:complete',
      'sales:view',
      'sales:update_order',
      'sales:fulfillment',
      'reports:view',
    ],
  },
  {
    name: 'Content Team',
    description: 'Works on marketing, content, and campaign activities.',
    status: 'Active',
    isSystem: true,
    permissions: [
      'dashboard:view',
      'marketing:view',
      'marketing:create',
      'marketing:update',
      'marketing:delete',
      'reports:view',
    ],
  },
];

const DEFAULT_SYSTEM_SETTINGS = [
  { section: 'general', key: 'company_name', label: 'Company Name', value: 'ONEMISSION HQ', valueType: 'string', description: 'Official legal company name.' },
  { section: 'general', key: 'brand_name', label: 'Brand Name', value: 'ONEMISSION', valueType: 'string', description: 'Brand name used across the ERP.' },
  { section: 'general', key: 'timezone', label: 'Timezone', value: 'Asia/Jakarta', valueType: 'string', description: 'Primary operating timezone.' },
  { section: 'general', key: 'currency', label: 'Currency', value: 'IDR', valueType: 'string', description: 'Default accounting currency.' },
  { section: 'general', key: 'language', label: 'Language', value: 'English', valueType: 'string', description: 'Default interface language.' },
  { section: 'order', key: 'order_prefix', label: 'Order Prefix', value: 'ORD', valueType: 'string', description: 'Prefix used for internal sales orders.' },
  { section: 'order', key: 'invoice_prefix', label: 'Invoice Prefix', value: 'INV', valueType: 'string', description: 'Prefix used for invoices.' },
  { section: 'order', key: 'customer_prefix', label: 'Customer Prefix', value: 'OMC', valueType: 'string', description: 'Prefix used for customer codes.' },
  { section: 'order', key: 'default_minimum_stock_threshold', label: 'Minimum Stock Threshold Default', value: '5', valueType: 'number', description: 'Default threshold when creating inventory rows.' },
  { section: 'inventory', key: 'enable_negative_stock', label: 'Enable Negative Stock', value: 'false', valueType: 'boolean', description: 'Allow stock to drop below zero.' },
  { section: 'inventory', key: 'allow_manual_adjustment', label: 'Allow Manual Adjustment', value: 'true', valueType: 'boolean', description: 'Allow manual inventory adjustment workflow.' },
  { section: 'production', key: 'enable_production_workflow', label: 'Enable Production Workflow', value: 'true', valueType: 'boolean', description: 'Enable manufacturing flow in HQ.' },
  { section: 'production', key: 'enable_manual_inventory', label: 'Enable Manual Inventory', value: 'true', valueType: 'boolean', description: 'Allow manual inventory workflow alongside production.' },
  { section: 'security', key: 'password_minimum_length', label: 'Password Minimum Length', value: '8', valueType: 'number', description: 'Minimum user password length.' },
  { section: 'security', key: 'password_expiration_days', label: 'Password Expiration', value: '0', valueType: 'number', description: 'Optional password expiration in days. 0 disables expiration.' },
  { section: 'security', key: 'maximum_login_attempts', label: 'Maximum Login Attempts', value: '5', valueType: 'number', description: 'Maximum failed login attempts before temporary lockout.' },
  { section: 'security', key: 'session_timeout_minutes', label: 'Session Timeout', value: '480', valueType: 'number', description: 'Rolling session timeout in minutes.' },
];

const DEFAULT_NOTIFICATION_SETTINGS = [
  { category: 'email_customer', key: 'customer_order_created', label: 'Order Created', isEnabled: true },
  { category: 'email_customer', key: 'customer_payment_received', label: 'Payment Received', isEnabled: true },
  { category: 'email_customer', key: 'customer_order_shipped', label: 'Order Shipped', isEnabled: true },
  { category: 'email_customer', key: 'customer_order_delivered', label: 'Delivered', isEnabled: true },
  { category: 'internal', key: 'internal_low_stock_alert', label: 'Low Stock Alert', isEnabled: true },
  { category: 'internal', key: 'internal_new_order', label: 'New Order', isEnabled: true },
  { category: 'internal', key: 'internal_cash_out_approval', label: 'Cash Out Approval (Future)', isEnabled: false },
  { category: 'internal', key: 'internal_production_finished', label: 'Production Finished', isEnabled: true },
];

let defaultsBootstrapPromise = null;
let settingsCache = null;
let settingsCacheExpiresAt = 0;
const SETTINGS_CACHE_TTL_MS = 10_000;

export class HqSecurityError extends Error {
  constructor({ message, statusCode = 401, code = 'HQ_SECURITY_ERROR' }) {
    super(message);
    this.name = 'HqSecurityError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function parseUserAgent(userAgent = '') {
  const normalized = String(userAgent || '').toLowerCase();
  const browser = normalized.includes('edg/')
    ? 'Edge'
    : normalized.includes('chrome/')
      ? 'Chrome'
      : normalized.includes('safari/') && !normalized.includes('chrome/')
        ? 'Safari'
        : normalized.includes('firefox/')
          ? 'Firefox'
          : normalized.includes('opr/')
            ? 'Opera'
            : 'Unknown Browser';

  const device = /mobile|android|iphone|ipad/.test(normalized) ? 'Mobile Device' : 'Desktop';
  return { browser, device };
}

function extractIpAddress(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }

  return request.headers.get('x-real-ip') || '';
}

function buildPermissionKey(moduleKey, actionKey) {
  return `${moduleKey}:${actionKey}`;
}

function buildPermissionLookup(permissions = []) {
  return new Set(permissions.filter((permission) => permission.isAllowed !== false).map((permission) => buildPermissionKey(permission.moduleKey, permission.actionKey)));
}

function roleHasAllPermissions(roleName = '') {
  return String(roleName || '').trim() === 'Super Admin';
}

export function canUsePermission(user, permissionLookup, moduleKey, actionKey) {
  if (roleHasAllPermissions(user?.role)) {
    return true;
  }

  return permissionLookup.has(buildPermissionKey(moduleKey, actionKey));
}

export async function hashHqPassword(password) {
  return bcrypt.hash(String(password || ''), PASSWORD_HASH_ROUNDS);
}

export async function compareHqPassword(password, passwordHash) {
  if (!passwordHash) {
    return false;
  }

  return bcrypt.compare(String(password || ''), passwordHash);
}

export function invalidateHqSettingsCache() {
  settingsCache = null;
  settingsCacheExpiresAt = 0;
}

async function seedHqSecurityDefaults(prismaClient = prisma) {
  for (const roleBlueprint of DEFAULT_ROLE_BLUEPRINTS) {
    let role = await prismaClient.role.findFirst({ where: { name: roleBlueprint.name } });
    if (!role) {
      role = await prismaClient.role.create({
        data: {
          id: crypto.randomUUID(),
          name: roleBlueprint.name,
          description: roleBlueprint.description,
          status: roleBlueprint.status,
          isSystem: roleBlueprint.isSystem,
        },
      });
    }

    const existingPermissions = await prismaClient.rolePermission.count({ where: { roleId: role.id } });
    if (existingPermissions === 0) {
      const permissions = roleBlueprint.allowAll
        ? HQ_PERMISSION_CATALOG.flatMap((module) => module.actions.map((action) => ({ moduleKey: module.moduleKey, actionKey: action.key })))
        : (roleBlueprint.permissions || []).map((permission) => {
            const [moduleKey, actionKey] = permission.split(':');
            return { moduleKey, actionKey };
          });

      if (permissions.length > 0) {
        await prismaClient.rolePermission.createMany({
          data: permissions.map((permission) => ({
            id: crypto.randomUUID(),
            roleId: role.id,
            moduleKey: permission.moduleKey,
            actionKey: permission.actionKey,
            isAllowed: true,
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  for (const setting of DEFAULT_SYSTEM_SETTINGS) {
    const existing = await prismaClient.systemSetting.findFirst({ where: { settingKey: setting.key } });
    if (!existing) {
      await prismaClient.systemSetting.create({
        data: {
          id: crypto.randomUUID(),
          settingKey: setting.key,
          section: setting.section,
          label: setting.label,
          value: setting.value,
          valueType: setting.valueType,
          description: setting.description,
        },
      });
    }
  }

  for (const setting of DEFAULT_NOTIFICATION_SETTINGS) {
    const existing = await prismaClient.notificationSetting.findFirst({ where: { settingKey: setting.key } });
    if (!existing) {
      await prismaClient.notificationSetting.create({
        data: {
          id: crypto.randomUUID(),
          category: setting.category,
          settingKey: setting.key,
          label: setting.label,
          isEnabled: setting.isEnabled,
        },
      });
    }
  }
}

export async function ensureHqSecurityDefaults(prismaClient = prisma) {
  if (prismaClient !== prisma) {
    await seedHqSecurityDefaults(prismaClient);
    return;
  }

  if (!defaultsBootstrapPromise) {
    defaultsBootstrapPromise = seedHqSecurityDefaults(prismaClient).catch((error) => {
      defaultsBootstrapPromise = null;
      throw error;
    });
  }

  await defaultsBootstrapPromise;
}

export async function getSystemSettingsMap(prismaClient = prisma, { forceRefresh = false } = {}) {
  await ensureHqSecurityDefaults(prismaClient);

  if (prismaClient === prisma && !forceRefresh && settingsCache && Date.now() < settingsCacheExpiresAt) {
    return settingsCache;
  }

  const settings = await prismaClient.systemSetting.findMany();
  const map = settings.reduce((accumulator, setting) => {
    accumulator[setting.settingKey] = setting;
    return accumulator;
  }, {});

  if (prismaClient === prisma) {
    settingsCache = map;
    settingsCacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS;
  }

  return map;
}

export function readBooleanSetting(setting, fallback = false) {
  if (!setting) return fallback;
  return String(setting.value || '').trim().toLowerCase() === 'true';
}

export function readNumberSetting(setting, fallback = 0) {
  if (!setting) return fallback;
  const parsed = Number(setting.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeUser(user, permissionLookup) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    permissionKeys: roleHasAllPermissions(user.role) ? ['*'] : [...permissionLookup],
  };
}

export async function writeAuditLog({ prismaClient = prisma, user = null, module = '', action = '', description = '', metadata = null, ipAddress = '' } = {}) {
  return prismaClient.auditLog.create({
    data: {
      id: crypto.randomUUID(),
      userId: user?.id || null,
      userName: user?.name || user?.email || '',
      module,
      action,
      description,
      metadata,
      ipAddress,
    },
  });
}

export async function createHqSession({ prismaClient = prisma, user, request }) {
  const settings = await getSystemSettingsMap(prismaClient);
  const sessionTimeoutMinutes = readNumberSetting(settings.session_timeout_minutes, 480);
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const userAgent = request.headers.get('user-agent') || '';
  const { browser, device } = parseUserAgent(userAgent);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionTimeoutMinutes * 60_000);

  const session = await prismaClient.userSession.create({
    data: {
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash,
      browser,
      device,
      ipAddress: extractIpAddress(request),
      userAgent,
      lastActivityAt: now,
      expiresAt,
    },
  });

  return {
    token: rawToken,
    session,
    sessionTimeoutMinutes,
  };
}

export async function authenticateHqRequest(request, { prismaClient = prisma, optional = false, touchSession = true } = {}) {
  const token = request.cookies.get(HQ_SESSION_COOKIE_NAME)?.value || '';
  if (!token) {
    if (optional) {
      return { user: null, session: null, permissions: [], permissionLookup: new Set(), settings: {} };
    }
    throw new HqSecurityError({ message: 'Authentication is required.', statusCode: 401, code: 'HQ_AUTH_REQUIRED' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await prismaClient.userSession.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
    },
    include: {
      user: true,
    },
  });

  if (!session || !session.user) {
    if (optional) {
      return { user: null, session: null, permissions: [], permissionLookup: new Set(), settings: {} };
    }
    throw new HqSecurityError({ message: 'Session is invalid or has been revoked.', statusCode: 401, code: 'HQ_SESSION_INVALID' });
  }

  if (session.user.status !== 'Active') {
    throw new HqSecurityError({ message: 'User is inactive.', statusCode: 403, code: 'HQ_USER_INACTIVE' });
  }

  const settings = await getSystemSettingsMap(prismaClient);
  const sessionTimeoutMinutes = readNumberSetting(settings.session_timeout_minutes, 480);
  const now = new Date();
  const inactiveDeadline = new Date(session.lastActivityAt.getTime() + sessionTimeoutMinutes * 60_000);
  const effectiveExpiry = session.expiresAt && session.expiresAt < inactiveDeadline ? session.expiresAt : inactiveDeadline;

  if (effectiveExpiry <= now) {
    await prismaClient.userSession.update({
      where: { id: session.id },
      data: { revokedAt: now },
    });
    throw new HqSecurityError({ message: 'Session has expired.', statusCode: 401, code: 'HQ_SESSION_EXPIRED' });
  }

  if (touchSession) {
    await prismaClient.userSession.update({
      where: { id: session.id },
      data: {
        lastActivityAt: now,
        expiresAt: new Date(now.getTime() + sessionTimeoutMinutes * 60_000),
      },
    });
  }

  const role = await prismaClient.role.findFirst({
    where: { name: session.user.role },
    include: { permissions: true },
  });
  const permissions = role?.permissions || [];
  const permissionLookup = buildPermissionLookup(permissions);

  return {
    user: sanitizeUser(session.user, permissionLookup),
    rawUser: session.user,
    session,
    settings,
    permissions,
    permissionLookup,
  };
}

export async function requireHqPermission(request, moduleKey, actionKey, { prismaClient = prisma } = {}) {
  const auth = await authenticateHqRequest(request, { prismaClient });
  if (!canUsePermission(auth.user, auth.permissionLookup, moduleKey, actionKey)) {
    throw new HqSecurityError({
      message: 'You do not have permission to perform this action.',
      statusCode: 403,
      code: 'HQ_PERMISSION_DENIED',
    });
  }

  return auth;
}

export async function loginHqUser({ email, password, request, prismaClient = prisma } = {}) {
  await ensureHqSecurityDefaults(prismaClient);
  const settings = await getSystemSettingsMap(prismaClient);
  const maximumLoginAttempts = readNumberSetting(settings.maximum_login_attempts, 5);
  const passwordExpirationDays = readNumberSetting(settings.password_expiration_days, 0);
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPassword = String(password || '');

  if (!normalizedEmail || !normalizedPassword) {
    throw new HqSecurityError({ message: 'Email and password are required.', statusCode: 400, code: 'HQ_LOGIN_REQUIRED' });
  }

  const user = await prismaClient.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });

  if (!user) {
    throw new HqSecurityError({ message: 'Invalid credentials.', statusCode: 401, code: 'HQ_LOGIN_INVALID' });
  }

  if (user.status !== 'Active') {
    throw new HqSecurityError({ message: 'This user is inactive.', statusCode: 403, code: 'HQ_LOGIN_USER_INACTIVE' });
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HqSecurityError({ message: 'Maximum login attempts reached. Please try again later.', statusCode: 423, code: 'HQ_LOGIN_LOCKED' });
  }

  let isValidPassword = false;
  if (user.passwordHash) {
    isValidPassword = await compareHqPassword(normalizedPassword, user.passwordHash);
  } else {
    isValidPassword = user.password === normalizedPassword;
  }

  if (!isValidPassword) {
    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    await prismaClient.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: failedAttempts,
        lockedUntil: failedAttempts >= maximumLoginAttempts ? new Date(Date.now() + DEFAULT_LOCKOUT_MINUTES * 60_000) : null,
      },
    });
    throw new HqSecurityError({ message: 'Invalid credentials.', statusCode: 401, code: 'HQ_LOGIN_INVALID' });
  }

  if (passwordExpirationDays > 0 && user.passwordChangedAt) {
    const expiredAt = new Date(user.passwordChangedAt.getTime() + passwordExpirationDays * 24 * 60 * 60_000);
    if (expiredAt <= new Date()) {
      throw new HqSecurityError({ message: 'Password has expired. Please contact an administrator to reset it.', statusCode: 403, code: 'HQ_PASSWORD_EXPIRED' });
    }
  }

  const passwordHash = user.passwordHash || await hashHqPassword(normalizedPassword);
  const updatedUser = await prismaClient.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      passwordChangedAt: user.passwordChangedAt || new Date(),
    },
  });

  const role = await prismaClient.role.findFirst({ where: { name: updatedUser.role }, include: { permissions: true } });
  const permissionLookup = buildPermissionLookup(role?.permissions || []);
  const { token, session, sessionTimeoutMinutes } = await createHqSession({ prismaClient, user: updatedUser, request });
  const safeUser = sanitizeUser(updatedUser, permissionLookup);

  await writeAuditLog({
    prismaClient,
    user: safeUser,
    module: 'AUTH',
    action: 'LOGIN',
    description: `HQ user ${updatedUser.email} signed in.`,
    ipAddress: extractIpAddress(request),
    metadata: {
      sessionId: session.id,
    },
  });

  return {
    user: safeUser,
    token,
    sessionTimeoutMinutes,
  };
}

export async function logoutHqSession(request, { prismaClient = prisma } = {}) {
  const token = request.cookies.get(HQ_SESSION_COOKIE_NAME)?.value || '';
  if (!token) {
    return null;
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await prismaClient.userSession.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  await prismaClient.userSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  await writeAuditLog({
    prismaClient,
    user: session.user ? { id: session.user.id, name: session.user.name, email: session.user.email } : null,
    module: 'AUTH',
    action: 'LOGOUT',
    description: `HQ user ${session.user?.email || ''} signed out.`,
    ipAddress: extractIpAddress(request),
    metadata: { sessionId: session.id },
  });

  return session;
}

export async function forceLogoutUserSessions({ prismaClient = prisma, userId, revokedBy, exceptSessionId = '' } = {}) {
  if (!userId) return 0;

  const where = {
    userId,
    revokedAt: null,
  };
  if (exceptSessionId) {
    where.id = { not: exceptSessionId };
  }

  const result = await prismaClient.userSession.updateMany({
    where,
    data: {
      revokedAt: new Date(),
    },
  });

  await writeAuditLog({
    prismaClient,
    user: revokedBy,
    module: 'SETTINGS',
    action: 'FORCE_LOGOUT',
    description: `Force logout executed for user ${userId}.`,
    metadata: { userId, exceptSessionId, count: result.count },
  });

  return result.count;
}

export function clearHqSessionCookie(response) {
  response.cookies.set(HQ_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
}

export function attachHqSessionCookie(response, token, sessionTimeoutMinutes) {
  response.cookies.set(HQ_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(Date.now() + sessionTimeoutMinutes * 60_000),
  });
}
