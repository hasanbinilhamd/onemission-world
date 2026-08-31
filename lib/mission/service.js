import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/hq-security';
import {
  MISSION_STATUS,
  MAX_ACTIVE_MISSION_OPTIONS,
  countActiveOptions,
  validateOpenableMission,
  computeMissionResults,
} from './rules';

/**
 * Movement Mission CMS + voting backend.
 *
 * CMS controls WHAT users can vote for (content + options + status).
 * Voting data (who/what/when) is recorded separately and results are always
 * COMPUTED from real vote records — never editable by admins.
 *
 * Hard business rules:
 *  - At most ONE mission OPEN at a time (enforced by the openLock unique
 *    column at the database level — race-safe).
 *  - At most 4 active options per voting mission.
 *  - One vote per customer per mission (DB unique constraint).
 */

const DEFAULT_MISSION = {
  eyebrow: 'YOUR VOICE, OUR NEXT STEP',
  title: 'THE NEXT MISSION IS YOURS.',
  description: 'Your vote will shape our next move as a movement.',
};

const DEFAULT_MISSION_OPTIONS = [
  { title: 'PESANTREN', description: 'Support sports facilities and apparel for santri.', displayOrder: 1 },
  { title: 'MUSLIM FOOTBALL', description: 'Empower Muslim teams to play with identity and purpose.', displayOrder: 2 },
  { title: 'MUSLIM CALISTHENICS', description: 'Build a strong and disciplined Muslim fitness community.', displayOrder: 3 },
  { title: 'YOUTH DEVELOPMENT', description: 'Invest in the next generation through sports and character.', displayOrder: 4 },
];

export class MissionContentError extends Error {
  constructor({ message, statusCode = 400, code = 'MISSION_CONTENT_ERROR' }) {
    super(message);
    this.name = 'MissionContentError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeText(value, fallback = '', maxLength = 500) {
  return String(value ?? fallback).trim().slice(0, maxLength);
}

function normalizeOption(input = {}, index = 0) {
  return {
    id: normalizeText(input.id, `temp-option-${Date.now()}-${index}`, 64),
    title: normalizeText(input.title, '', 120),
    description: normalizeText(input.description, '', 240),
    image: normalizeText(input.image, '', 2000),
    displayOrder: Number.isFinite(Number(input.displayOrder)) ? Number(input.displayOrder) : index + 1,
    isActive: input.isActive !== false,
  };
}

function serializeMission(mission) {
  return {
    id: mission.id,
    eyebrow: mission.eyebrow,
    title: mission.title,
    description: mission.description,
    status: mission.status,
    startDate: mission.startDate,
    endDate: mission.endDate,
    createdAt: mission.createdAt,
    updatedAt: mission.updatedAt,
  };
}

function serializeOption(option) {
  return {
    id: option.id,
    title: option.title,
    description: option.description,
    image: option.image,
    displayOrder: option.displayOrder,
    isActive: option.isActive,
  };
}

async function seedMissionDefaults(prismaClient = prisma) {
  const missionCount = await prismaClient.mission.count();
  if (missionCount > 0) return;

  const mission = await prismaClient.mission.create({
    data: {
      ...DEFAULT_MISSION,
      status: MISSION_STATUS.DRAFT,
    },
  });

  await prismaClient.missionOption.createMany({
    data: DEFAULT_MISSION_OPTIONS.map((option) => ({
      id: crypto.randomUUID(),
      missionId: mission.id,
      ...option,
    })),
  });
}

let missionDefaultsPromise = null;

export async function ensureMissionDefaults(prismaClient = prisma) {
  if (prismaClient !== prisma) {
    await seedMissionDefaults(prismaClient);
    return;
  }

  if (!missionDefaultsPromise) {
    missionDefaultsPromise = seedMissionDefaults(prismaClient).catch((error) => {
      missionDefaultsPromise = null;
      throw error;
    });
  }

  await missionDefaultsPromise;
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

export const missionContentService = {
  // ── PUBLIC ────────────────────────────────────────────────────────────────

  async getPublicMissionContent() {
    await ensureMissionDefaults();

    // Prefer the OPEN mission; otherwise expose the most recent mission so
    // content stays available (status tells the frontend if voting is open).
    let mission = await prisma.mission.findFirst({
      where: { status: MISSION_STATUS.OPEN },
      orderBy: { updatedAt: 'desc' },
    });

    if (!mission) {
      mission = await prisma.mission.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!mission) {
      throw new MissionContentError({
        message: 'No voting mission is configured yet.',
        statusCode: 404,
        code: 'MISSION_NOT_CONFIGURED',
      });
    }

    const options = await prisma.missionOption.findMany({
      where: { missionId: mission.id, isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const votes = await prisma.missionVote.groupBy({
      by: ['missionOptionId'],
      where: { missionId: mission.id },
      _count: { _all: true },
    });

    const countsByOptionId = {};
    for (const row of votes) {
      countsByOptionId[row.missionOptionId] = row._count._all;
    }

    const { totalVotes, results } = computeMissionResults({
      countsByOptionId,
      activeOptionIds: options.map((option) => option.id),
    });

    return {
      mission: serializeMission(mission),
      options: options.map(serializeOption),
      results,
      totalVotes,
    };
  },

  async recordVote({ missionOptionId, customerId }) {
    if (!customerId) {
      throw new MissionContentError({
        message: 'Sign in is required to vote.',
        statusCode: 401,
        code: 'MISSION_VOTE_AUTH_REQUIRED',
      });
    }

    const openMission = await prisma.mission.findFirst({
      where: { status: MISSION_STATUS.OPEN },
      orderBy: { updatedAt: 'desc' },
    });

    if (!openMission) {
      throw new MissionContentError({
        message: 'Voting is currently closed.',
        statusCode: 409,
        code: 'MISSION_NOT_OPEN',
      });
    }

    const option = await prisma.missionOption.findUnique({
      where: { id: String(missionOptionId || '') },
    });

    if (!option || option.missionId !== openMission.id || !option.isActive) {
      throw new MissionContentError({
        message: 'The selected option is not available in the current voting mission.',
        statusCode: 400,
        code: 'MISSION_OPTION_INVALID',
      });
    }

    try {
      await prisma.missionVote.create({
        data: {
          id: crypto.randomUUID(),
          missionId: openMission.id,
          missionOptionId: option.id,
          customerId: String(customerId),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new MissionContentError({
          message: 'You have already voted in this mission.',
          statusCode: 409,
          code: 'MISSION_VOTE_ALREADY_RECORDED',
        });
      }
      throw error;
    }

    return this.getPublicMissionContent();
  },

  // ── ADMIN ─────────────────────────────────────────────────────────────────

  async getAdminMissionContent() {
    await ensureMissionDefaults();

    const missions = await prisma.mission.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        options: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
        _count: { select: { votes: true } },
      },
    });

    return {
      missions: missions.map((mission) => ({
        ...serializeMission(mission),
        optionCount: mission.options.length,
        activeOptionCount: countActiveOptions(mission.options),
        totalVotes: mission._count.votes,
      })),
    };
  },

  async getAdminMissionDetail(missionId) {
    await ensureMissionDefaults();

    const mission = await prisma.mission.findUnique({
      where: { id: String(missionId || '') },
      include: {
        options: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    if (!mission) {
      throw new MissionContentError({
        message: 'Mission was not found.',
        statusCode: 404,
        code: 'MISSION_NOT_FOUND',
      });
    }

    return {
      mission: serializeMission(mission),
      options: mission.options.map(serializeOption),
      activeOptionCount: countActiveOptions(mission.options),
      maxActiveOptions: MAX_ACTIVE_MISSION_OPTIONS,
    };
  },

  async createMission({ eyebrow = '', title = '', description = '', user = null } = {}) {
    const mission = await prisma.mission.create({
      data: {
        id: crypto.randomUUID(),
        eyebrow: normalizeText(eyebrow, DEFAULT_MISSION.eyebrow, 240),
        title: normalizeText(title, '', 240),
        description: normalizeText(description, '', 500),
        status: MISSION_STATUS.DRAFT,
      },
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_MISSION_CREATED',
      description: 'A new voting mission draft was created.',
      metadata: { missionId: mission.id },
    });

    return this.getAdminMissionDetail(mission.id);
  },

  async updateMissionContent({ missionId, content = {}, user = null } = {}) {
    const mission = await prisma.mission.findUnique({ where: { id: String(missionId || '') } });
    if (!mission) {
      throw new MissionContentError({
        message: 'Mission was not found.',
        statusCode: 404,
        code: 'MISSION_NOT_FOUND',
      });
    }

    await prisma.mission.update({
      where: { id: mission.id },
      data: {
        eyebrow: normalizeText(content.eyebrow, mission.eyebrow, 240),
        title: normalizeText(content.title, mission.title, 240),
        description: normalizeText(content.description, mission.description, 500),
      },
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_MISSION_CONTENT_UPDATED',
      description: 'Voting mission content was updated.',
      metadata: { missionId: mission.id },
    });

    return this.getAdminMissionDetail(mission.id);
  },

  async replaceMissionOptions({ missionId, options = [], user = null } = {}) {
    const mission = await prisma.mission.findUnique({
      where: { id: String(missionId || '') },
      include: { options: true },
    });
    if (!mission) {
      throw new MissionContentError({
        message: 'Mission was not found.',
        statusCode: 404,
        code: 'MISSION_NOT_FOUND',
      });
    }

    const tempIdPattern = /^temp-option-/;
    const normalizedOptions = options.map((option, index) => normalizeOption(option, index));
    const preparedOptions = normalizedOptions.map((option) => ({
      ...option,
      id: tempIdPattern.test(option.id) ? crypto.randomUUID() : option.id,
    }));

    const submittedIdSet = new Set(preparedOptions.map((option) => option.id));
    const removedOptions = mission.options.filter((option) => !submittedIdSet.has(option.id));

    const activeCount = countActiveOptions(preparedOptions);

    if (activeCount > MAX_ACTIVE_MISSION_OPTIONS) {
      throw new MissionContentError({
        message: `A voting mission can have at most ${MAX_ACTIVE_MISSION_OPTIONS} active options. You tried to save ${activeCount} active options.`,
        statusCode: 400,
        code: 'MISSION_OPTIONS_ACTIVE_LIMIT_EXCEEDED',
      });
    }

    if (mission.status === MISSION_STATUS.OPEN) {
      const validation = validateOpenableMission({ activeOptionCount: activeCount });
      if (!validation.ok) {
        throw new MissionContentError({
          message: validation.reason,
          statusCode: 400,
          code: validation.code,
        });
      }
    }

    // Diff-based update — votes are NEVER cascade-deleted:
    //  - submitted options are upserted by id
    //  - options removed from the list keep their votes: they are deactivated
    //    (preserved as history); only vote-less options are deleted
    await prisma.$transaction(async (tx) => {
      for (const option of preparedOptions) {
        const existing = await tx.missionOption.findUnique({ where: { id: option.id } });
        if (existing && existing.missionId === mission.id) {
          await tx.missionOption.update({
            where: { id: option.id },
            data: {
              title: option.title,
              description: option.description,
              image: option.image,
              displayOrder: option.displayOrder,
              isActive: option.isActive,
            },
          });
        } else {
          await tx.missionOption.create({
            data: {
              id: option.id,
              missionId: mission.id,
              title: option.title,
              description: option.description,
              image: option.image,
              displayOrder: option.displayOrder,
              isActive: option.isActive,
            },
          });
        }
      }

      for (const removedOption of removedOptions) {
        const voteCount = await tx.missionVote.count({
          where: { missionOptionId: removedOption.id },
        });
        if (voteCount > 0) {
          await tx.missionOption.update({
            where: { id: removedOption.id },
            data: { isActive: false },
          });
        } else {
          await tx.missionOption.delete({ where: { id: removedOption.id } });
        }
      }
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_MISSION_OPTIONS_UPDATED',
      description: 'Voting mission options were updated.',
      metadata: { missionId: mission.id, totalOptions: preparedOptions.length, activeOptions: activeCount },
    });

    return this.getAdminMissionDetail(mission.id);
  },

  async setMissionStatus({ missionId, status, user = null } = {}) {
    const normalizedStatus = String(status || '').trim().toUpperCase();
    if (!Object.values(MISSION_STATUS).includes(normalizedStatus)) {
      throw new MissionContentError({
        message: 'Invalid mission status.',
        statusCode: 400,
        code: 'MISSION_STATUS_INVALID',
      });
    }

    const mission = await prisma.mission.findUnique({
      where: { id: String(missionId || '') },
      include: { options: true },
    });
    if (!mission) {
      throw new MissionContentError({
        message: 'Mission was not found.',
        statusCode: 404,
        code: 'MISSION_NOT_FOUND',
      });
    }

    if (normalizedStatus === MISSION_STATUS.OPEN) {
      const activeCount = countActiveOptions(mission.options);
      const validation = validateOpenableMission({ activeOptionCount: activeCount });
      if (!validation.ok) {
        throw new MissionContentError({
          message: validation.reason,
          statusCode: 400,
          code: validation.code,
        });
      }

      // One-OPEN rule: the unique openLock column guarantees at most one
      // OPEN mission even under concurrent admin actions (race-safe).
      try {
        await prisma.mission.update({
          where: { id: mission.id },
          data: {
            status: MISSION_STATUS.OPEN,
            openLock: 'open',
            startDate: mission.startDate || new Date(),
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          const currentlyOpen = await prisma.mission.findFirst({
            where: { status: MISSION_STATUS.OPEN },
            orderBy: { updatedAt: 'desc' },
          });
          throw new MissionContentError({
            message: `Another voting mission is currently open${currentlyOpen ? `: "${currentlyOpen.title || 'Untitled mission'}"` : ''}. Close the current mission before opening a new one.`,
            statusCode: 409,
            code: 'MISSION_ALREADY_OPEN',
          });
        }
        throw error;
      }
    } else {
      await prisma.mission.update({
        where: { id: mission.id },
        data: {
          status: normalizedStatus,
          openLock: null,
          ...(normalizedStatus === MISSION_STATUS.CLOSED ? { endDate: mission.endDate || new Date() } : {}),
        },
      });
    }

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_MISSION_STATUS_CHANGED',
      description: `Voting mission status changed to ${normalizedStatus}.`,
      metadata: { missionId: mission.id, status: normalizedStatus },
    });

    return this.getAdminMissionDetail(mission.id);
  },
};
