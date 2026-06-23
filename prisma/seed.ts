import { PrismaClient } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import {
  SEED_USERS,
  SEED_PRODUCTS,
  SEED_INVENTORY,
  SEED_PLANS,
  SEED_CONTENT,
  SEED_CREATORS,
  SEED_SCHOOLS,
  SEED_TIMELINE,
  SEED_FINANCE,
  SEED_EVENTS,
  SEED_NOTIFICATIONS,
  SEED_FINANCIAL_ACCOUNTS,
  SEED_COA,
} from '../lib/seed-data';

const prisma = new PrismaClient();

const SUPER_ADMIN = {
  id: uuid(),
  email: 'superadmin@onemission.com',
  password: 'SuperAdmin123!',
  name: 'Super Admin',
  role: 'Super Admin',
  avatar: 'SA',
};

async function main() {
  console.log('Seeding database...');

  await prisma.cashTransaction.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.event.deleteMany();
  await prisma.finance.deleteMany();
  await prisma.timeline.deleteMany();
  await prisma.school.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.content.deleteMany();
  await prisma.plan.deleteMany();
  // await prisma.inventory.deleteMany();
  // await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.financialAccount.deleteMany();

  // Delete child COA records first (those with a parentId), then parents
  await prisma.chartOfAccount.deleteMany({ where: { parentId: { not: null } } });
  await prisma.chartOfAccount.deleteMany();

  const users = [SUPER_ADMIN, ...SEED_USERS];
  await prisma.user.createMany({ data: users });

  // await prisma.product.createMany({ data: SEED_PRODUCTS });

  // const productIds = SEED_PRODUCTS.map((p) => p.id);
  // await prisma.inventory.createMany({ data: SEED_INVENTORY(productIds) });

  await prisma.plan.createMany({ data: SEED_PLANS });
  await prisma.content.createMany({ data: SEED_CONTENT });
  await prisma.creator.createMany({ data: SEED_CREATORS });
  await prisma.school.createMany({ data: SEED_SCHOOLS });
  await prisma.timeline.createMany({ data: SEED_TIMELINE });
  await prisma.finance.createMany({ data: SEED_FINANCE });
  await prisma.event.createMany({ data: SEED_EVENTS });
  await prisma.notification.createMany({ data: SEED_NOTIFICATIONS });

  // Seed Financial Accounts
  await prisma.financialAccount.createMany({ data: SEED_FINANCIAL_ACCOUNTS });

  // Seed COA: insert parents first, then children
  const parents = SEED_COA.filter((a) => !a.parentId);
  const children = SEED_COA.filter((a) => !!a.parentId);
  await prisma.chartOfAccount.createMany({ data: parents });
  await prisma.chartOfAccount.createMany({ data: children });

  console.log('Seed completed successfully.');
  console.log(`Super Admin: ${SUPER_ADMIN.email}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
