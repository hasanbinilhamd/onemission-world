import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { compareHqPassword, hashHqPassword, invalidateHqSettingsCache } from '@/lib/hq-security';

const SETTING_KEYS = {
  enabled: 'early_access_enabled',
  chapter: 'early_access_chapter',
  passwordHash: 'early_access_password_hash',
  revision: 'early_access_revision',
};

const DEFAULT_SETTINGS = [
  { key: SETTING_KEYS.enabled, label: 'Early Access Enabled', value: 'false', valueType: 'boolean', description: 'Lock Ecommerce behind Early Access password gate.' },
  { key: SETTING_KEYS.chapter, label: 'Early Access Chapter', value: 'CHAPTER 01', valueType: 'string', description: 'Current Early Access chapter.' },
  { key: SETTING_KEYS.passwordHash, label: 'Early Access Password Hash', value: '', valueType: 'secret', description: 'Bcrypt hash for current Early Access password.' },
  { key: SETTING_KEYS.revision, label: 'Early Access Revision', value: crypto.randomUUID(), valueType: 'string', description: 'Revision used to invalidate Early Access sessions.' },
];

export class EarlyAccessError extends Error {
  constructor({ message, statusCode = 400, code = 'EARLY_ACCESS_ERROR' }) {
    super(message);
    this.name = 'EarlyAccessError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizePasswordInput(value) {
  return String(value || '').trim();
}

export class EarlyAccessService {
  constructor({ prismaClient = prisma } = {}) {
    this.prisma = prismaClient;
  }

  async ensureSettings() {
    for (const setting of DEFAULT_SETTINGS) {
      await this.prisma.systemSetting.upsert({
        where: { settingKey: setting.key },
        update: {},
        create: {
          id: crypto.randomUUID(),
          settingKey: setting.key,
          section: 'early_access',
          label: setting.label,
          value: setting.value,
          valueType: setting.valueType,
          description: setting.description,
        },
      });
    }
  }

  async getSettingsMap() {
    await this.ensureSettings();
    const rows = await this.prisma.systemSetting.findMany({
      where: { settingKey: { in: Object.values(SETTING_KEYS) } },
    });
    return rows.reduce((map, row) => {
      map[row.settingKey] = row;
      return map;
    }, {});
  }

  buildResponse(settingsMap) {
    return {
      enabled: normalizeBoolean(settingsMap[SETTING_KEYS.enabled]?.value, false),
      chapter: String(settingsMap[SETTING_KEYS.chapter]?.value || 'CHAPTER 01').trim() || 'CHAPTER 01',
      hasPassword: Boolean(String(settingsMap[SETTING_KEYS.passwordHash]?.value || '').trim()),
      revision: String(settingsMap[SETTING_KEYS.revision]?.value || '').trim(),
    };
  }

  async getAdminConfig() {
    return this.buildResponse(await this.getSettingsMap());
  }

  async getPublicStatus() {
    const config = await this.getAdminConfig();
    return {
      enabled: config.enabled,
      chapter: config.chapter,
      revision: config.revision,
      hasPassword: config.hasPassword,
    };
  }

  async updateConfig({ enabled, chapter, password = '' } = {}) {
    const settingsMap = await this.getSettingsMap();
    const currentChapter = String(settingsMap[SETTING_KEYS.chapter]?.value || 'CHAPTER 01').trim() || 'CHAPTER 01';
    const currentPasswordHash = String(settingsMap[SETTING_KEYS.passwordHash]?.value || '').trim();
    const nextChapter = String(chapter ?? currentChapter).trim() || 'CHAPTER 01';
    const nextEnabled = normalizeBoolean(enabled, normalizeBoolean(settingsMap[SETTING_KEYS.enabled]?.value, false));
    const nextPassword = normalizePasswordInput(password);
    const chapterChanged = nextChapter !== currentChapter;
    const passwordChanged = Boolean(nextPassword);

    if (nextPassword && nextPassword.length < 4) {
      throw new EarlyAccessError({ message: 'Early Access password must be at least 4 characters.', statusCode: 400, code: 'EARLY_ACCESS_PASSWORD_TOO_SHORT' });
    }

    if (nextEnabled && !currentPasswordHash && !nextPassword) {
      throw new EarlyAccessError({ message: 'Early Access password is required before enabling Early Access.', statusCode: 400, code: 'EARLY_ACCESS_PASSWORD_REQUIRED' });
    }

    const updates = [
      this.prisma.systemSetting.update({ where: { settingKey: SETTING_KEYS.enabled }, data: { value: String(nextEnabled) } }),
      this.prisma.systemSetting.update({ where: { settingKey: SETTING_KEYS.chapter }, data: { value: nextChapter } }),
    ];

    if (passwordChanged) {
      updates.push(this.prisma.systemSetting.update({
        where: { settingKey: SETTING_KEYS.passwordHash },
        data: { value: await hashHqPassword(nextPassword) },
      }));
    }

    if (chapterChanged || passwordChanged) {
      updates.push(this.prisma.systemSetting.update({ where: { settingKey: SETTING_KEYS.revision }, data: { value: crypto.randomUUID() } }));
    }

    await this.prisma.$transaction(updates);

    invalidateHqSettingsCache();
    return this.getAdminConfig();
  }



  async verifyPassword(password = '') {
    const configMap = await this.getSettingsMap();
    const config = this.buildResponse(configMap);
    if (!config.enabled) {
      return { valid: true, ...config };
    }

    const passwordHash = String(configMap[SETTING_KEYS.passwordHash]?.value || '').trim();
    if (!passwordHash) {
      throw new EarlyAccessError({ message: 'Early Access password has not been configured.', statusCode: 423, code: 'EARLY_ACCESS_PASSWORD_NOT_CONFIGURED' });
    }

    const valid = await compareHqPassword(String(password || ''), passwordHash);
    if (!valid) {
      throw new EarlyAccessError({ message: 'Access password is invalid.', statusCode: 401, code: 'EARLY_ACCESS_PASSWORD_INVALID' });
    }

    return { valid: true, ...config };
  }
}

export const earlyAccessService = new EarlyAccessService();

export function normalizeEarlyAccessError(error) {
  if (error instanceof EarlyAccessError) return error;
  return new EarlyAccessError({ message: 'Early Access request could not be completed.', statusCode: 500, code: 'EARLY_ACCESS_INTERNAL_ERROR' });
}
