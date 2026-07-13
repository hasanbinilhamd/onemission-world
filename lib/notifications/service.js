import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { ensureHqSecurityDefaults } from '@/lib/hq-security';

const DEFAULT_RECENT_LIMIT = 5;
const DEFAULT_LIST_LIMIT = 20;
const SETTINGS_CACHE_TTL_MS = 300_000;

let notificationSettingsCache = null;
let notificationSettingsCacheExpiresAt = 0;

export const NOTIFICATION_EVENT_TYPE = {
  NEW_ORDER: 'NEW_ORDER',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_REFUNDED: 'ORDER_REFUNDED',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  MANUAL_STOCK_ADJUSTMENT: 'MANUAL_STOCK_ADJUSTMENT',
  PRODUCTION_STARTED: 'PRODUCTION_STARTED',
  PRODUCTION_FINISHED: 'PRODUCTION_FINISHED',
  CASH_IN_CREATED: 'CASH_IN_CREATED',
  CASH_OUT_CREATED: 'CASH_OUT_CREATED',
  USER_CREATED: 'USER_CREATED',
  ROLE_UPDATED: 'ROLE_UPDATED',
  CONTENT_REMINDER: 'CONTENT_REMINDER',
};

const EVENT_SETTING_KEYS = {
  [NOTIFICATION_EVENT_TYPE.NEW_ORDER]: 'internal_new_order',
  [NOTIFICATION_EVENT_TYPE.PAYMENT_RECEIVED]: 'internal_payment_received',
  [NOTIFICATION_EVENT_TYPE.ORDER_CANCELLED]: 'internal_order_cancelled',
  [NOTIFICATION_EVENT_TYPE.ORDER_REFUNDED]: 'internal_order_refunded',
  [NOTIFICATION_EVENT_TYPE.ORDER_DELIVERED]: 'internal_order_delivered',
  [NOTIFICATION_EVENT_TYPE.LOW_STOCK]: 'internal_low_stock_alert',
  [NOTIFICATION_EVENT_TYPE.OUT_OF_STOCK]: 'internal_out_of_stock',
  [NOTIFICATION_EVENT_TYPE.MANUAL_STOCK_ADJUSTMENT]: 'internal_manual_stock_adjustment',
  [NOTIFICATION_EVENT_TYPE.PRODUCTION_STARTED]: 'internal_production_started',
  [NOTIFICATION_EVENT_TYPE.PRODUCTION_FINISHED]: 'internal_production_finished',
  [NOTIFICATION_EVENT_TYPE.CASH_IN_CREATED]: 'internal_cash_in_created',
  [NOTIFICATION_EVENT_TYPE.CASH_OUT_CREATED]: 'internal_cash_out_created',
  [NOTIFICATION_EVENT_TYPE.USER_CREATED]: 'internal_user_created',
  [NOTIFICATION_EVENT_TYPE.ROLE_UPDATED]: 'internal_role_updated',
};

const DEFAULT_NOTIFICATION_SETTINGS = [
  { category: 'email_customer', settingKey: 'customer_order_created', label: 'Order Created', isEnabled: true },
  { category: 'email_customer', settingKey: 'customer_payment_received', label: 'Payment Received', isEnabled: true },
  { category: 'email_customer', settingKey: 'customer_order_shipped', label: 'Order Shipped', isEnabled: true },
  { category: 'email_customer', settingKey: 'customer_order_delivered', label: 'Delivered', isEnabled: true },
  { category: 'internal', settingKey: 'internal_low_stock_alert', label: 'Low Stock Alert', isEnabled: true },
  { category: 'internal', settingKey: 'internal_new_order', label: 'New Order', isEnabled: true },
  { category: 'internal', settingKey: 'internal_payment_received', label: 'Payment Received', isEnabled: true },
  { category: 'internal', settingKey: 'internal_order_cancelled', label: 'Order Cancelled', isEnabled: true },
  { category: 'internal', settingKey: 'internal_order_refunded', label: 'Order Refunded', isEnabled: true },
  { category: 'internal', settingKey: 'internal_order_delivered', label: 'Order Delivered', isEnabled: true },
  { category: 'internal', settingKey: 'internal_out_of_stock', label: 'Out of Stock', isEnabled: true },
  { category: 'internal', settingKey: 'internal_manual_stock_adjustment', label: 'Manual Stock Adjustment', isEnabled: true },
  { category: 'internal', settingKey: 'internal_cash_out_approval', label: 'Cash Out Approval (Future)', isEnabled: false },
  { category: 'internal', settingKey: 'internal_production_started', label: 'Production Started', isEnabled: true },
  { category: 'internal', settingKey: 'internal_production_finished', label: 'Production Finished', isEnabled: true },
  { category: 'internal', settingKey: 'internal_cash_in_created', label: 'Cash In Created', isEnabled: true },
  { category: 'internal', settingKey: 'internal_cash_out_created', label: 'Cash Out Created', isEnabled: true },
  { category: 'internal', settingKey: 'internal_user_created', label: 'User Created', isEnabled: true },
  { category: 'internal', settingKey: 'internal_role_updated', label: 'Role Updated', isEnabled: true },
];

function normalizeString(value) {
  return String(value || '').trim();
}

function relativeTimeFromNow(dateValue) {
  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) {
    return '';
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export function invalidateNotificationSettingsCache() {
  notificationSettingsCache = null;
  notificationSettingsCacheExpiresAt = 0;
}

async function ensureNotificationSettings(prismaClient = prisma) {
  if (!prismaClient.notificationSetting) {
    return;
  }

  await ensureHqSecurityDefaults(prismaClient);

  for (const setting of DEFAULT_NOTIFICATION_SETTINGS) {
    const existing = await prismaClient.notificationSetting.findFirst({
      where: { settingKey: setting.settingKey },
    });
    if (!existing) {
      await prismaClient.notificationSetting.create({
        data: {
          id: crypto.randomUUID(),
          category: setting.category,
          settingKey: setting.settingKey,
          label: setting.label,
          isEnabled: setting.isEnabled,
        },
      });
    }
  }
}

async function getNotificationSettingsMap(prismaClient = prisma, { forceRefresh = false } = {}) {
  await ensureNotificationSettings(prismaClient);

  if (prismaClient === prisma && !forceRefresh && notificationSettingsCache && Date.now() < notificationSettingsCacheExpiresAt) {
    return notificationSettingsCache;
  }

  const rows = await prismaClient.notificationSetting.findMany();
  const map = rows.reduce((accumulator, setting) => {
    accumulator[setting.settingKey] = setting;
    return accumulator;
  }, {});

  if (prismaClient === prisma) {
    notificationSettingsCache = map;
    notificationSettingsCacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS;
  }

  return map;
}

function eventDefinition(type, payload = {}) {
  const definitions = {
    [NOTIFICATION_EVENT_TYPE.NEW_ORDER]: {
      module: 'SALES',
      severity: 'info',
      title: 'New Order',
      message: `Order ${payload.publicOrderNumber || payload.orderNumber || ''} was created for ${payload.customerName || 'a customer'}.`,
      actionUrl: 'orders',
      actionLabel: 'Open Order',
      referenceId: payload.publicOrderNumber || payload.orderNumber || '',
    },
    [NOTIFICATION_EVENT_TYPE.PAYMENT_RECEIVED]: {
      module: 'SALES',
      severity: 'success',
      title: 'Payment Received',
      message: `Payment was received for order ${payload.publicOrderNumber || payload.orderNumber || ''}.`,
      actionUrl: 'orders',
      actionLabel: 'Open Order',
      referenceId: payload.publicOrderNumber || payload.orderNumber || '',
    },
    [NOTIFICATION_EVENT_TYPE.ORDER_CANCELLED]: {
      module: 'SALES',
      severity: 'warning',
      title: 'Order Cancelled',
      message: `Order ${payload.publicOrderNumber || payload.orderNumber || ''} was cancelled.`,
      actionUrl: 'orders',
      actionLabel: 'Open Order',
      referenceId: payload.publicOrderNumber || payload.orderNumber || '',
    },
    [NOTIFICATION_EVENT_TYPE.ORDER_REFUNDED]: {
      module: 'SALES',
      severity: 'warning',
      title: 'Order Refunded',
      message: `Order ${payload.publicOrderNumber || payload.orderNumber || ''} was refunded.`,
      actionUrl: 'orders',
      actionLabel: 'Open Order',
      referenceId: payload.publicOrderNumber || payload.orderNumber || '',
    },
    [NOTIFICATION_EVENT_TYPE.ORDER_DELIVERED]: {
      module: 'SALES',
      severity: 'success',
      title: 'Order Delivered',
      message: `Order ${payload.publicOrderNumber || payload.orderNumber || ''} was marked as delivered.`,
      actionUrl: 'orders',
      actionLabel: 'Open Order',
      referenceId: payload.publicOrderNumber || payload.orderNumber || '',
    },
    [NOTIFICATION_EVENT_TYPE.LOW_STOCK]: {
      module: 'INVENTORY',
      severity: 'warning',
      title: 'Low Stock',
      message: `Only ${payload.quantity ?? 0} units remaining for ${payload.productName || payload.referenceLabel || 'this item'}.`,
      actionUrl: 'inventory',
      actionLabel: 'Open Inventory',
      referenceId: payload.referenceId || payload.inventoryId || '',
    },
    [NOTIFICATION_EVENT_TYPE.OUT_OF_STOCK]: {
      module: 'INVENTORY',
      severity: 'critical',
      title: 'Out of Stock',
      message: `${payload.productName || payload.referenceLabel || 'An item'} is now out of stock.`,
      actionUrl: 'inventory',
      actionLabel: 'Open Inventory',
      referenceId: payload.referenceId || payload.inventoryId || '',
    },
    [NOTIFICATION_EVENT_TYPE.MANUAL_STOCK_ADJUSTMENT]: {
      module: 'INVENTORY',
      severity: 'info',
      title: 'Manual Stock Adjustment',
      message: `Manual stock adjustment recorded for ${payload.productName || payload.referenceLabel || 'inventory item'}.`,
      actionUrl: 'stockmovements',
      actionLabel: 'Open Stock Movements',
      referenceId: payload.referenceId || payload.inventoryId || '',
    },
    [NOTIFICATION_EVENT_TYPE.PRODUCTION_STARTED]: {
      module: 'PRODUCTION',
      severity: 'info',
      title: 'Production Started',
      message: `Production order ${payload.productionOrderNumber || ''} has started for ${payload.productName || 'a product'}.`,
      actionUrl: 'productionorders',
      actionLabel: 'Open Production Orders',
      referenceId: payload.productionOrderId || '',
    },
    [NOTIFICATION_EVENT_TYPE.PRODUCTION_FINISHED]: {
      module: 'PRODUCTION',
      severity: 'success',
      title: 'Production Finished',
      message: `Production result ${payload.resultNumber || ''} finished ${Number(payload.actualQuantity || 0).toLocaleString('id-ID')} pcs of ${payload.productName || 'a product'}.`,
      actionUrl: 'productionresults',
      actionLabel: 'Open Production Results',
      referenceId: payload.productionResultId || payload.productionOrderId || '',
    },
    [NOTIFICATION_EVENT_TYPE.CASH_IN_CREATED]: {
      module: 'FINANCE',
      severity: 'success',
      title: 'Cash In Created',
      message: `Cash In ${payload.referenceNumber || payload.transactionId || ''} was recorded for ${payload.amountFormatted || ''}.`,
      actionUrl: 'cashin',
      actionLabel: 'Open Cash In',
      referenceId: payload.transactionId || '',
    },
    [NOTIFICATION_EVENT_TYPE.CASH_OUT_CREATED]: {
      module: 'FINANCE',
      severity: 'info',
      title: 'Cash Out Created',
      message: `Cash Out ${payload.referenceNumber || payload.transactionId || ''} was recorded for ${payload.amountFormatted || ''}.`,
      actionUrl: 'cashout',
      actionLabel: 'Open Cash Out',
      referenceId: payload.transactionId || '',
    },
    [NOTIFICATION_EVENT_TYPE.USER_CREATED]: {
      module: 'SYSTEM',
      severity: 'info',
      title: 'User Created',
      message: `User ${payload.email || payload.name || ''} was created.`,
      actionUrl: 'users',
      actionLabel: 'Open Users',
      referenceId: payload.userId || '',
    },
    [NOTIFICATION_EVENT_TYPE.ROLE_UPDATED]: {
      module: 'SYSTEM',
      severity: 'info',
      title: 'Role Updated',
      message: `Role ${payload.roleName || ''} was updated.`,
      actionUrl: 'rolespermissions',
      actionLabel: 'Open Roles',
      referenceId: payload.roleId || '',
    },
    [NOTIFICATION_EVENT_TYPE.CONTENT_REMINDER]: {
      module: 'MARKETING',
      severity: 'info',
      title: 'Content Reminder',
      message: payload.message || `Reminder for ${payload.title || 'planned content'}.`,
      actionUrl: 'content',
      actionLabel: 'Open Content Planner',
      referenceId: payload.contentId || '',
    },
  };

  return definitions[type] || {
    module: 'SYSTEM',
    severity: 'info',
    title: type,
    message: normalizeString(payload.message) || 'Notification event recorded.',
    actionUrl: '',
    actionLabel: '',
    referenceId: normalizeString(payload.referenceId),
  };
}

function mapNotificationRow(row) {
  return {
    ...row,
    relativeTime: relativeTimeFromNow(row.createdAt),
  };
}

export class NotificationService {
  constructor({ prismaClient = prisma, nowFactory = () => new Date() } = {}) {
    this.prisma = prismaClient;
    this.nowFactory = nowFactory;
  }

  async isSettingEnabled(settingKey, { prismaClient = this.prisma } = {}) {
    if (!settingKey) return true;
    if (!prismaClient.notificationSetting) return true;
    const settings = await getNotificationSettingsMap(prismaClient);
    const setting = settings[settingKey];
    return setting ? Boolean(setting.isEnabled) : true;
  }

  async dispatch({ type, payload = {}, prismaClient = this.prisma } = {}) {
    if (!prismaClient.notification?.create) {
      return { skipped: true, reason: 'NOTIFICATION_STORAGE_UNAVAILABLE' };
    }

    const settingKey = EVENT_SETTING_KEYS[type] || '';
    const isEnabled = await this.isSettingEnabled(settingKey, { prismaClient });
    if (!isEnabled) {
      return { skipped: true, reason: 'SETTING_DISABLED' };
    }

    const definition = eventDefinition(type, payload);
    const notification = await prismaClient.notification.create({
      data: {
        id: crypto.randomUUID(),
        type,
        module: definition.module,
        title: definition.title,
        message: definition.message,
        severity: definition.severity,
        read: false,
        actionUrl: normalizeString(definition.actionUrl),
        actionLabel: normalizeString(definition.actionLabel),
        referenceId: normalizeString(definition.referenceId),
        createdAt: this.nowFactory().toISOString(),
      },
    });

    return {
      skipped: false,
      notification,
    };
  }

  async getSummary({ prismaClient = this.prisma, limit = DEFAULT_RECENT_LIMIT } = {}) {
    if (!prismaClient.notification) {
      return { unreadCount: 0, recent: [] };
    }

    const [unreadCount, recent] = await Promise.all([
      prismaClient.notification.count({ where: { read: false } }),
      prismaClient.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    return {
      unreadCount,
      recent: recent.map(mapNotificationRow),
    };
  }

  async list({ prismaClient = this.prisma, search = '', status = 'all', severity = 'all', page = 1, limit = DEFAULT_LIST_LIMIT } = {}) {
    if (!prismaClient.notification) {
      return {
        data: [],
        pagination: { page: 1, limit: DEFAULT_LIST_LIMIT, totalItems: 0, totalPages: 1, hasNextPage: false, hasPreviousPage: false },
        unreadCount: 0,
      };
    }

    const normalizedSearch = normalizeString(search).toLowerCase();
    const normalizedPage = Number.isFinite(Number(page)) && Number(page) > 0 ? Math.trunc(Number(page)) : 1;
    const normalizedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Math.trunc(Number(limit)), 100) : DEFAULT_LIST_LIMIT;

    const rows = await prismaClient.notification.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const filtered = rows.filter((row) => {
      const matchesStatus = status === 'all' || (status === 'unread' ? !row.read : row.read);
      const matchesSeverity = severity === 'all' || String(row.severity || '').toLowerCase() === String(severity || '').toLowerCase();
      const matchesSearch = !normalizedSearch || [row.title, row.message, row.type, row.module, row.referenceId].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
      return matchesStatus && matchesSeverity && matchesSearch;
    });

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / normalizedLimit));
    const safePage = Math.min(normalizedPage, totalPages);
    const paginated = filtered.slice((safePage - 1) * normalizedLimit, safePage * normalizedLimit);

    return {
      data: paginated.map(mapNotificationRow),
      pagination: {
        page: safePage,
        limit: normalizedLimit,
        totalItems,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1,
      },
      unreadCount: filtered.filter((row) => !row.read).length,
    };
  }

  async markRead(notificationId, { prismaClient = this.prisma } = {}) {
    if (!prismaClient.notification) return null;
    if (!notificationId) return null;
    const existing = await prismaClient.notification.findUnique({ where: { id: notificationId } });
    if (!existing) return null;
    if (existing.read) return existing;
    return prismaClient.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async markAllRead({ prismaClient = this.prisma } = {}) {
    if (!prismaClient.notification) return { count: 0 };
    return prismaClient.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
  }

  async deleteRead({ prismaClient = this.prisma } = {}) {
    if (!prismaClient.notification) return { count: 0 };
    return prismaClient.notification.deleteMany({
      where: { read: true },
    });
  }
}

export const notificationService = new NotificationService();
