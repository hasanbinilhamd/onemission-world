import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Always cache globally — prevents "too many connections" across
// Next.js hot reloads (dev) and keeps one stable instance in production.
globalForPrisma.prisma = prisma;
