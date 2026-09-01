import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/hq-security';
import {
  IMPACT_STATUS,
  IMPACT_CATEGORIES,
  sortImpactStoriesForPublic,
  filterImpactStoriesByStatus,
  slugifyTitle,
  normalizeImpactCategory,
  normalizeImpactStatus,
  computeImpactReadingMinutes,
  validateImpactBlock,
} from './rules';

/**
 * Movement Impact CMS + public API.
 *
 * Impact is a documentation/storytelling system: stories mix TEXT and IMAGE
 * blocks, support many images, and are ordered publicly by status priority
 * (NOW LIVE → COMING SOON → CLOSED; DRAFT never public). Only ONE story can
 * be featured (enforced by a partial unique index at the database level).
 */

const DEFAULT_PAGE_SETTING = {
  eyebrow: 'IMPACT',
  title: 'THE WORK BEHIND THE MOVEMENT.',
  description: 'Stories, progress, people, and ideas shaping what we are building together.',
};

// Seed content mirrors the previously approved Impact/Journal content.
const DEFAULT_IMPACT_STORIES = [
  {
    title: '100 Athletes. One Purpose.',
    slug: 'mission-001-100-athletes',
    category: 'JOURNEY',
    shortDescription:
      "Mission 001 is the movement's first public goal: one hundred Muslim athletes, training, competing, and representing their values — one community at a time.",
    coverImage: '/images/journal/journal-featured.jpg',
    status: 'NOW_LIVE',
    featured: true,
    blocks: [
      { type: 'TEXT', text: "Mission 001 is the movement's first public goal: one hundred Muslim athletes — training, competing, and representing their values in every arena they enter. Not a number for its own sake, but a way to make the movement visible, one person at a time." },
      { type: 'TEXT', text: 'It begins where every movement begins: with the people who show up. Runners before Fajr, footballers on borrowed pitches, calisthenics athletes on public bars, santri between classes. This page will follow their stories — and ours — as the mission moves forward.' },
    ],
  },
  {
    title: 'Running Before Sunrise',
    slug: 'running-before-sunrise',
    category: 'PEOPLE',
    shortDescription:
      'For one runner in Bandung, the first kilometers of the day begin before Fajr — a quiet rhythm of discipline and prayer.',
    coverImage: '/images/journal/journal-athlete.jpg',
    status: 'NOW_LIVE',
    featured: false,
    blocks: [
      { type: 'TEXT', text: 'The city is still dark when he laces up. Before the first prayer of the day, before traffic, before the noise — a short loop through empty streets, breath steady, footsteps even.' },
      { type: 'TEXT', text: 'It is not about speed. It is about showing up every single morning, and carrying that same consistency into everything that follows. That is the athlete One Mission is built for.' },
    ],
  },
  {
    title: 'Every Touch With Purpose',
    slug: 'every-touch-with-purpose',
    category: 'PEOPLE',
    shortDescription:
      'Muslim footballers across the city are reclaiming the pitch — training with intention, playing with identity.',
    coverImage: '/images/mission/mission-football.jpg',
    status: 'NOW_LIVE',
    featured: false,
    blocks: [
      { type: 'TEXT', text: 'Football has always been more than a game in this city. For a growing number of players, it is a place where identity is not left at the sideline — it is worn on the sleeve, and in the way they play.' },
      { type: 'TEXT', text: 'Training with intention means treating every touch as an act of discipline. The pitch becomes a classroom, and every session a chance to represent something larger than the score.' },
    ],
  },
  {
    title: 'The Santri Who Trains At Dawn',
    slug: 'the-santri-who-trains-at-dawn',
    category: 'PEOPLE',
    shortDescription:
      'Between classes and Quran study, sport is becoming a daily anchor for young santri.',
    coverImage: '/images/journal/journal-santri.jpg',
    status: 'NOW_LIVE',
    featured: false,
    blocks: [
      { type: 'TEXT', text: 'Life inside a pesantren follows its own clock. Study begins early, and the day is full. But before the first lesson, a growing group of santri has made space for movement — a short run, a set of push-ups, a stretch.' },
      { type: 'TEXT', text: 'The goal is not to become athletes. The goal is a body that can serve: strong enough to study long hours, disciplined enough to pray on time, and present enough to help the people around them.' },
    ],
  },
  {
    title: 'Eleven Brothers, One Team',
    slug: 'eleven-brothers-one-team',
    category: 'COMMUNITY',
    shortDescription:
      'A Muslim football community that began with borrowed balls now trains together every week.',
    coverImage: '/images/journal/journal-community.jpg',
    status: 'NOW_LIVE',
    featured: false,
    blocks: [
      { type: 'TEXT', text: "Every community starts small. This one started with a group of friends, a borrowed ball, and a patch of grass that nobody else was using on Friday afternoons." },
      { type: 'TEXT', text: 'Now they train together every week. New players arrive through word of mouth, and the rule is simple: everyone is welcome, everyone defends, everyone shares the ball. The team is the message.' },
    ],
  },
  {
    title: 'The Open Bar Movement',
    slug: 'the-open-bar-movement',
    category: 'COMMUNITY',
    shortDescription:
      'Calisthenics parks are becoming gathering points — where strength training meets brotherhood.',
    coverImage: '/images/mission/mission-calisthenics.jpg',
    status: 'NOW_LIVE',
    featured: false,
    blocks: [
      { type: 'TEXT', text: 'You do not need a membership to build strength. A bar in a public park is enough. That simple fact is drawing more and more young Muslims to calisthenics — not as a solo pursuit, but as a shared one.' },
      { type: 'TEXT', text: 'At the parks, training happens in pairs and groups. Someone holds the bar, someone counts the reps, someone encourages from the side. Strength, it turns out, is a community activity.' },
    ],
  },
  {
    title: 'Pesantren, After Class',
    slug: 'pesantren-after-class',
    category: 'COMMUNITY',
    shortDescription:
      'When the lesson ends, the field begins. Sports programs inside pesantren are taking shape.',
    coverImage: '/images/mission/mission-pesantren.jpg',
    status: 'NOW_LIVE',
    featured: false,
    blocks: [
      { type: 'TEXT', text: "The classroom is only half of a santri's day. In the hours after study, the field is where energy, discipline, and friendship meet — and where sports programs inside pesantren are quietly taking shape." },
      { type: 'TEXT', text: 'The vision is simple: every pesantren with a patch of grass deserves a ball, a pair of shoes, and a teacher who believes that a strong body supports a strong student.' },
    ],
  },
  {
    title: 'Modesty Is a Performance Layer',
    slug: 'modesty-is-a-performance-layer',
    category: 'PHILOSOPHY',
    shortDescription:
      'What we wear to move is not a compromise — it is part of how we perform.',
    coverImage: '/images/journal/journal-philosophy.jpg',
    status: 'NOW_LIVE',
    featured: false,
    blocks: [
      { type: 'TEXT', text: 'Modesty is often talked about as a limitation. In practice, it is a design brief. Coverage that moves with the body, fabric that breathes, silhouettes that work in any setting — that is performance without compromise.' },
      { type: 'TEXT', text: 'One Mission exists to make that brief real: sportswear built for athletes who want to train, compete, and represent — without leaving their values in the locker room.' },
    ],
  },
  {
    title: 'Calm Power',
    slug: 'calm-power',
    category: 'PHILOSOPHY',
    shortDescription:
      'Strength does not need to be loud. The movement is built on a simple idea: move quietly, build consistently.',
    coverImage: '/images/journal/journal-dawn.jpg',
    status: 'NOW_LIVE',
    featured: false,
    blocks: [
      { type: 'TEXT', text: 'The loudest person in the room is rarely the strongest. One Mission moves in the opposite direction: calm power — the steady confidence of someone who has done the work, day after day, without announcing it.' },
      { type: 'TEXT', text: 'It is a philosophy that fits the people this movement is built for. Quiet routines. Consistent training. Faith carried naturally. Results that speak without shouting.' },
    ],
  },
  {
    title: 'What We Built This Month',
    slug: 'what-we-built-this-month',
    category: 'JOURNEY',
    shortDescription:
      "A short, honest log of the movement's work: product drops, community sessions, and the small steps between them.",
    coverImage: '/images/journal/journal-gear.jpg',
    status: 'CLOSED',
    featured: false,
    blocks: [
      { type: 'TEXT', text: "Accountability begins with a habit of recording. This is the movement's monthly log — a plain record of what was built, what was shipped, and what is still in progress." },
      { type: 'TEXT', text: 'This month: new performance pieces arrived at the warehouse, community training sessions continued in Bandung, and the first conversations about pesantren sports programs began. Small steps, written down.' },
    ],
  },
  {
    title: 'Where Your Votes Are Taking Us',
    slug: 'where-your-votes-are-taking-us',
    category: 'JOURNEY',
    shortDescription:
      'The community voted. Pesantren leads with 48 percent. Here is how we are preparing to move.',
    coverImage: '/images/journal/journal-track.jpg',
    status: 'NOW_LIVE',
    featured: false,
    blocks: [
      { type: 'TEXT', text: 'You voted. 48 percent of the community chose Pesantren as the next mission — sportswear and sports facilities for santri. Muslim Football followed with 31 percent, Calisthenics with 13, and Youth Development with 8.' },
      { type: 'TEXT', text: 'The vote is a compass, not a finish line. Preparation is now underway: understanding what pesantren actually need, where to start, and how the community can move together. When the mission begins, this page will be the record of it.' },
    ],
  },
];

export class ImpactContentError extends Error {
  constructor({ message, statusCode = 400, code = 'IMPACT_CONTENT_ERROR' }) {
    super(message);
    this.name = 'ImpactContentError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeText(value, fallback = '', maxLength = 500) {
  return String(value ?? fallback).trim().slice(0, maxLength);
}

function serializeStorySummary(story, readingMinutes = null) {
  return {
    id: story.id,
    title: story.title,
    slug: story.slug,
    category: story.category,
    shortDescription: story.shortDescription,
    coverImage: story.coverImage,
    status: story.status,
    featured: story.featured,
    publishedAt: story.publishedAt,
    readingMinutes,
  };
}

function serializeBlock(block) {
  return {
    id: block.id,
    type: block.type,
    displayOrder: block.displayOrder,
    text: block.text,
    imageUrl: block.imageUrl,
    altText: block.altText,
    caption: block.caption,
  };
}

async function seedImpactDefaults(prismaClient = prisma) {
  const [settingCount, storyCount] = await prismaClient.$transaction([
    prismaClient.impactPageSetting.count(),
    prismaClient.impactStory.count(),
  ]);

  if (settingCount === 0) {
    await prismaClient.impactPageSetting.create({ data: { ...DEFAULT_PAGE_SETTING } });
  }

  if (storyCount === 0) {
    for (const story of DEFAULT_IMPACT_STORIES) {
      await prismaClient.impactStory.create({
        data: {
          id: crypto.randomUUID(),
          title: story.title,
          slug: story.slug,
          category: story.category,
          shortDescription: story.shortDescription,
          coverImage: story.coverImage,
          status: story.status,
          featured: story.featured,
          publishedAt: story.status === IMPACT_STATUS.DRAFT ? null : new Date(),
          blocks: {
            create: story.blocks.map((block, index) => ({
              id: crypto.randomUUID(),
              type: block.type,
              displayOrder: index + 1,
              text: block.type === 'TEXT' ? block.text : null,
              imageUrl: block.type === 'IMAGE' ? block.imageUrl : null,
              altText: block.type === 'IMAGE' ? block.altText : null,
              caption: block.type === 'IMAGE' ? block.caption : null,
            })),
          },
        },
      });
    }
  }
}

let impactDefaultsPromise = null;

export async function ensureImpactDefaults(prismaClient = prisma) {
  if (prismaClient !== prisma) {
    await seedImpactDefaults(prismaClient);
    return;
  }

  if (!impactDefaultsPromise) {
    impactDefaultsPromise = seedImpactDefaults(prismaClient).catch((error) => {
      impactDefaultsPromise = null;
      throw error;
    });
  }

  await impactDefaultsPromise;
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

async function loadPublicStories({ status = 'ALL', sort = 'latest' } = {}) {
  const normalizedStatus = String(status || 'ALL').trim().toUpperCase();
  const where = {
    status: { not: IMPACT_STATUS.DRAFT },
  };
  if (normalizedStatus !== 'ALL' && Object.values(IMPACT_STATUS).includes(normalizedStatus)) {
    where.status = normalizedStatus;
  }

  const stories = await prisma.impactStory.findMany({
    where,
    include: { blocks: { where: { type: 'TEXT' }, select: { text: true } } },
  });

  const filtered = filterImpactStoriesByStatus(stories, normalizedStatus);
  return sortImpactStoriesForPublic(filtered, sort).map((story) =>
    serializeStorySummary(story, computeImpactReadingMinutes(story.blocks)),
  );
}

export const impactContentService = {
  // ── PUBLIC ────────────────────────────────────────────────────────────────

  async getPublicImpactList({ status = 'ALL', sort = 'latest', offset = 0, limit = 12 } = {}) {
    await ensureImpactDefaults();

    const normalizedOffset = Math.max(0, Number(offset) || 0);
    const normalizedLimit = Math.min(24, Math.max(1, Number(limit) || 12));

    const settings = await prisma.impactPageSetting.findUnique({ where: { id: 'impact' } });
    const sorted = await loadPublicStories({ status, sort });

    return {
      settings: {
        eyebrow: settings?.eyebrow || DEFAULT_PAGE_SETTING.eyebrow,
        title: settings?.title || DEFAULT_PAGE_SETTING.title,
        description: settings?.description || DEFAULT_PAGE_SETTING.description,
      },
      items: sorted.slice(normalizedOffset, normalizedOffset + normalizedLimit),
      total: sorted.length,
      hasMore: normalizedOffset + normalizedLimit < sorted.length,
    };
  },

  async getPublicImpactStory(slug) {
    await ensureImpactDefaults();

    const story = await prisma.impactStory.findUnique({
      where: { slug: String(slug || '').trim().toLowerCase() },
      include: { blocks: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!story || story.status === IMPACT_STATUS.DRAFT) {
      throw new ImpactContentError({
        message: 'Impact was not found.',
        statusCode: 404,
        code: 'IMPACT_NOT_FOUND',
      });
    }

    const related = await prisma.impactStory.findMany({
      where: {
        category: story.category,
        id: { not: story.id },
        status: { not: IMPACT_STATUS.DRAFT },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 3,
    });

    const textBlocks = story.blocks.filter((block) => block.type === 'TEXT');

    return {
      story: serializeStorySummary(story, computeImpactReadingMinutes(textBlocks)),
      blocks: story.blocks.map(serializeBlock),
      related: related.map((item) => ({
        slug: item.slug,
        title: item.title,
        category: item.category,
        coverImage: item.coverImage,
        status: item.status,
      })),
    };
  },

  // ── ADMIN ─────────────────────────────────────────────────────────────────

  async getAdminImpactContent() {
    await ensureImpactDefaults();

    const [settings, stories] = await Promise.all([
      prisma.impactPageSetting.findUnique({ where: { id: 'impact' } }),
      prisma.impactStory.findMany({
        orderBy: [{ createdAt: 'desc' }],
        include: {
          blocks: { where: { type: 'TEXT' }, select: { text: true } },
          _count: { select: { blocks: true } },
        },
      }),
    ]);

    return {
      settings: {
        eyebrow: settings?.eyebrow || DEFAULT_PAGE_SETTING.eyebrow,
        title: settings?.title || DEFAULT_PAGE_SETTING.title,
        description: settings?.description || DEFAULT_PAGE_SETTING.description,
      },
      stories: stories.map((story) => ({
        ...serializeStorySummary(story, computeImpactReadingMinutes(story.blocks)),
        blockCount: story._count.blocks,
      })),
    };
  },

  async getAdminImpactStory(storyId) {
    await ensureImpactDefaults();

    const story = await prisma.impactStory.findUnique({
      where: { id: String(storyId || '') },
      include: { blocks: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!story) {
      throw new ImpactContentError({
        message: 'Impact was not found.',
        statusCode: 404,
        code: 'IMPACT_NOT_FOUND',
      });
    }

    return {
      story: serializeStorySummary(
        story,
        computeImpactReadingMinutes(story.blocks.filter((block) => block.type === 'TEXT')),
      ),
      blocks: story.blocks.map(serializeBlock),
      categories: IMPACT_CATEGORIES,
    };
  },

  async updateImpactSettings({ settings = {}, user = null } = {}) {
    await prisma.impactPageSetting.upsert({
      where: { id: 'impact' },
      create: { ...DEFAULT_PAGE_SETTING },
      update: {
        eyebrow: normalizeText(settings.eyebrow, DEFAULT_PAGE_SETTING.eyebrow, 240),
        title: normalizeText(settings.title, DEFAULT_PAGE_SETTING.title, 240),
        description: normalizeText(settings.description, DEFAULT_PAGE_SETTING.description, 500),
      },
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_IMPACT_SETTINGS_UPDATED',
      description: 'Impact page settings were updated.',
    });

    return this.getAdminImpactContent();
  },

  async createImpactStory({ story = {}, user = null } = {}) {
    const title = normalizeText(story.title, '', 240);
    let slug = normalizeText(story.slug, slugifyTitle(title), 160).toLowerCase();

    if (!slug) {
      throw new ImpactContentError({
        message: 'Impact slug is required.',
        statusCode: 400,
        code: 'IMPACT_SLUG_REQUIRED',
      });
    }

    const created = await prisma.impactStory.create({
      data: {
        id: crypto.randomUUID(),
        title,
        slug,
        category: normalizeImpactCategory(story.category),
        shortDescription: normalizeText(story.shortDescription, '', 500),
        coverImage: normalizeText(story.coverImage, '', 2000),
        status: normalizeImpactStatus(story.status),
        featured: false,
        publishedAt: null,
      },
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_IMPACT_CREATED',
      description: 'An Impact story was created.',
      metadata: { storyId: created.id, slug: created.slug },
    });

    return this.getAdminImpactStory(created.id);
  },

  async updateImpactStory({ storyId, story = {}, user = null } = {}) {
    const existing = await prisma.impactStory.findUnique({ where: { id: String(storyId || '') } });
    if (!existing) {
      throw new ImpactContentError({
        message: 'Impact was not found.',
        statusCode: 404,
        code: 'IMPACT_NOT_FOUND',
      });
    }

    let slug = normalizeText(story.slug, existing.slug, 160).toLowerCase();
    if (!slug) slug = existing.slug;

    try {
      await prisma.impactStory.update({
        where: { id: existing.id },
        data: {
          title: normalizeText(story.title, existing.title, 240),
          slug,
          category: normalizeImpactCategory(story.category || existing.category),
          shortDescription: normalizeText(story.shortDescription, existing.shortDescription, 500),
          coverImage: normalizeText(story.coverImage, existing.coverImage, 2000),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ImpactContentError({
          message: 'That slug is already used by another Impact story.',
          statusCode: 409,
          code: 'IMPACT_SLUG_TAKEN',
        });
      }
      throw error;
    }

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_IMPACT_UPDATED',
      description: 'An Impact story was updated.',
      metadata: { storyId: existing.id },
    });

    return this.getAdminImpactStory(existing.id);
  },

  async replaceImpactBlocks({ storyId, blocks = [], user = null } = {}) {
    const story = await prisma.impactStory.findUnique({ where: { id: String(storyId || '') } });
    if (!story) {
      throw new ImpactContentError({
        message: 'Impact was not found.',
        statusCode: 404,
        code: 'IMPACT_NOT_FOUND',
      });
    }

    const prepared = [];
    for (let index = 0; index < blocks.length; index += 1) {
      const validation = validateImpactBlock(blocks[index]);
      if (!validation.ok) {
        throw new ImpactContentError({
          message: `Block ${index + 1}: ${validation.reason}`,
          statusCode: 400,
          code: 'IMPACT_BLOCK_INVALID',
        });
      }
      prepared.push({
        id: crypto.randomUUID(),
        type: String(blocks[index].type).toUpperCase(),
        displayOrder: index + 1,
        text: String(blocks[index].type).toUpperCase() === 'TEXT' ? normalizeText(blocks[index].text, '', 4000) : null,
        imageUrl: String(blocks[index].type).toUpperCase() === 'IMAGE' ? normalizeText(blocks[index].imageUrl, '', 2000) : null,
        altText: String(blocks[index].type).toUpperCase() === 'IMAGE' ? normalizeText(blocks[index].altText, '', 500) : null,
        caption: String(blocks[index].type).toUpperCase() === 'IMAGE' ? normalizeText(blocks[index].caption, '', 500) : null,
      });
    }

    // Blocks have no external references — safe full replace in a transaction.
    await prisma.$transaction(async (tx) => {
      await tx.impactContentBlock.deleteMany({ where: { storyId: story.id } });
      if (prepared.length > 0) {
        await tx.impactContentBlock.createMany({
          data: prepared.map((block) => ({ ...block, storyId: story.id })),
        });
      }
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_IMPACT_BLOCKS_UPDATED',
      description: 'Impact content blocks were updated.',
      metadata: { storyId: story.id, totalBlocks: prepared.length },
    });

    return this.getAdminImpactStory(story.id);
  },

  async setImpactStatus({ storyId, status, user = null } = {}) {
    const rawStatus = String(status || '').trim().toUpperCase();
    if (!Object.values(IMPACT_STATUS).includes(rawStatus)) {
      throw new ImpactContentError({
        message: 'Invalid impact status.',
        statusCode: 400,
        code: 'IMPACT_STATUS_INVALID',
      });
    }
    const normalizedStatus = rawStatus;

    const story = await prisma.impactStory.findUnique({ where: { id: String(storyId || '') } });
    if (!story) {
      throw new ImpactContentError({
        message: 'Impact was not found.',
        statusCode: 404,
        code: 'IMPACT_NOT_FOUND',
      });
    }

    const becomesPublic =
      normalizedStatus === IMPACT_STATUS.COMING_SOON || normalizedStatus === IMPACT_STATUS.NOW_LIVE;

    await prisma.impactStory.update({
      where: { id: story.id },
      data: {
        status: normalizedStatus,
        ...(becomesPublic && !story.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_IMPACT_STATUS_CHANGED',
      description: `Impact status changed to ${normalizedStatus}.`,
      metadata: { storyId: story.id, status: normalizedStatus },
    });

    return this.getAdminImpactStory(story.id);
  },

  async setImpactFeatured({ storyId, featured, user = null } = {}) {
    const story = await prisma.impactStory.findUnique({ where: { id: String(storyId || '') } });
    if (!story) {
      throw new ImpactContentError({
        message: 'Impact was not found.',
        statusCode: 404,
        code: 'IMPACT_NOT_FOUND',
      });
    }

    const shouldFeature = Boolean(featured);

    await prisma.$transaction(async (tx) => {
      if (shouldFeature) {
        // Only ONE featured story: unset any previous featured first,
        // then set the new one (the partial unique index backs this up).
        await tx.impactStory.updateMany({
          where: { featured: true },
          data: { featured: false },
        });
      }
      await tx.impactStory.update({
        where: { id: story.id },
        data: { featured: shouldFeature },
      });
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_IMPACT_FEATURED_CHANGED',
      description: `Impact featured set to ${shouldFeature}.`,
      metadata: { storyId: story.id },
    });

    return this.getAdminImpactStory(story.id);
  },
};
