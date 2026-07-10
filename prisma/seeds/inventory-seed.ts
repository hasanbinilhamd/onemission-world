import { PrismaClient } from '@prisma/client';
import {
  INVENTORY_MOVEMENT_TYPE,
  INVENTORY_PERFORMED_BY,
  INVENTORY_REFERENCE_TYPE,
} from '../../lib/inventory/movement-service';

// ─── Product IDs (from product-seed.ts — DO NOT MODIFY) ─────────────────────
const PRODUCT_UDEL_OFF_LEGGING_ID         = '05f9c1f5-fdbd-4d9a-9a46-10ed5840d612';
const PRODUCT_COWBOY_RUNNING_CAP_ID       = '375c0877-d96d-495c-9162-dd32cce343fc';
const PRODUCT_BASIC_LONG_LEGGING_ID       = '812e5b24-d521-4c89-a9d9-dcad32fda52d';
const PRODUCT_FLEX_POCKET_LEGGING_ID      = '8e46a914-e6df-497e-839e-773c56712f90';
const PRODUCT_PRO_SPORT_LEGGING_ID        = 'd733f404-54e9-444d-b4c7-72cd49700ac3';
const PRODUCT_BASIC_THREE_QUARTER_LEGGING_ID = 'f64f0ae0-5df3-42fa-8df9-a8370e894123';

// ─── Deterministic Inventory IDs ────────────────────────────────────────────
// Derived from product ID + color + size to guarantee idempotent reseeding.
const INV_UDEL_BLACK_L        = 'a1f9c1f5-0001-4001-8001-10ed5840d001';
const INV_UDEL_BLACK_3XL      = 'a1f9c1f5-0001-4001-8001-10ed5840d002';

const INV_COWBOY_BLACK_ALL    = 'a2c0877d-0002-4002-8002-dd32cce34001';

const INV_BASIC_LONG_BLACK_XL  = 'a3e5b24d-0003-4003-8003-dcad32fda001';
const INV_BASIC_LONG_BLACK_3XL = 'a3e5b24d-0003-4003-8003-dcad32fda002';
const INV_BASIC_LONG_BLACK_5XL = 'a3e5b24d-0003-4003-8003-dcad32fda003';

const INV_FLEX_BLACK_L        = 'a4e6a914-0004-4004-8004-773c56712f01';
const INV_FLEX_BLACK_2XL      = 'a4e6a914-0004-4004-8004-773c56712f02';

const INV_PRO_BLACK_L         = 'a5f404d7-0005-4005-8005-72cd49700a01';
const INV_PRO_BLACK_2XL       = 'a5f404d7-0005-4005-8005-72cd49700a02';

const INV_BASIC_34_BLACK_XL   = 'a6f0ae0f-0006-4006-8006-a8370e894001';
const INV_BASIC_34_BLACK_3XL  = 'a6f0ae0f-0006-4006-8006-a8370e894002';
const INV_BASIC_34_BLACK_5XL  = 'a6f0ae0f-0006-4006-8006-a8370e894003';

// ─── Inventory Row Definition ───────────────────────────────────────────────
const INVENTORY_ROWS = [
  // UDEL OFF LEGGING — Black
  {
    id: INV_UDEL_BLACK_L,
    productId: PRODUCT_UDEL_OFF_LEGGING_ID,
    color: 'Black',
    size: 'L',
    quantity: 0,
    incoming: 0,
    threshold: 5,
  },
  {
    id: INV_UDEL_BLACK_3XL,
    productId: PRODUCT_UDEL_OFF_LEGGING_ID,
    color: 'Black',
    size: '3XL',
    quantity: 0,
    incoming: 0,
    threshold: 5,
  },

  // COWBOY RUNNING CAP — Black
  {
    id: INV_COWBOY_BLACK_ALL,
    productId: PRODUCT_COWBOY_RUNNING_CAP_ID,
    color: 'Black',
    size: 'AllSize',
    quantity: 0,
    incoming: 0,
    threshold: 5,
  },

  // BASIC LONG LEGGING — Black
  {
    id: INV_BASIC_LONG_BLACK_XL,
    productId: PRODUCT_BASIC_LONG_LEGGING_ID,
    color: 'Black',
    size: 'XL',
    quantity: 17,
    incoming: 0,
    threshold: 5,
  },
  {
    id: INV_BASIC_LONG_BLACK_3XL,
    productId: PRODUCT_BASIC_LONG_LEGGING_ID,
    color: 'Black',
    size: '3XL',
    quantity: 38,
    incoming: 0,
    threshold: 5,
  },
  {
    id: INV_BASIC_LONG_BLACK_5XL,
    productId: PRODUCT_BASIC_LONG_LEGGING_ID,
    color: 'Black',
    size: '5XL',
    quantity: 0,
    incoming: 0,
    threshold: 5,
  },

  // FLEX POCKET LEGGING — Black
  {
    id: INV_FLEX_BLACK_L,
    productId: PRODUCT_FLEX_POCKET_LEGGING_ID,
    color: 'Black',
    size: 'L',
    quantity: 12,
    incoming: 0,
    threshold: 5,
  },
  {
    id: INV_FLEX_BLACK_2XL,
    productId: PRODUCT_FLEX_POCKET_LEGGING_ID,
    color: 'Black',
    size: '2XL',
    quantity: 26,
    incoming: 0,
    threshold: 5,
  },

  // PRO SPORT LEGGING — Black
  {
    id: INV_PRO_BLACK_L,
    productId: PRODUCT_PRO_SPORT_LEGGING_ID,
    color: 'Black',
    size: 'L',
    quantity: 13,
    incoming: 0,
    threshold: 5,
  },
  {
    id: INV_PRO_BLACK_2XL,
    productId: PRODUCT_PRO_SPORT_LEGGING_ID,
    color: 'Black',
    size: '2XL',
    quantity: 29,
    incoming: 0,
    threshold: 5,
  },

  // BASIC 3/4 LEGGING — Black
  {
    id: INV_BASIC_34_BLACK_XL,
    productId: PRODUCT_BASIC_THREE_QUARTER_LEGGING_ID,
    color: 'Black',
    size: 'XL',
    quantity: 17,
    incoming: 0,
    threshold: 5,
  },
  {
    id: INV_BASIC_34_BLACK_3XL,
    productId: PRODUCT_BASIC_THREE_QUARTER_LEGGING_ID,
    color: 'Black',
    size: '3XL',
    quantity: 43,
    incoming: 0,
    threshold: 5,
  },
  {
    id: INV_BASIC_34_BLACK_5XL,
    productId: PRODUCT_BASIC_THREE_QUARTER_LEGGING_ID,
    color: 'Black',
    size: '5XL',
    quantity: 4,
    incoming: 0,
    threshold: 5,
  },
];

// ─── Seed Function (exported so seed runner can await it) ───────────────────
async function seedInventory(prisma) {
  console.log('Seeding deterministic inventory...');

  for (const row of INVENTORY_ROWS) {
    const inventory = await prisma.inventory.upsert({
      where: {
        productId_color_size: {
          productId: row.productId,
          color: row.color,
          size: row.size,
        },
      },
      update: {
        quantity: row.quantity,
        incoming: row.incoming,
        threshold: row.threshold,
      },
      create: row,
    });

    if (row.quantity > 0) {
      await prisma.stockMovement.upsert({
        where: {
          id: `initial-stock-${inventory.id}`,
        },
        update: {
          itemType: 'PRODUCT',
          inventoryId: inventory.id,
          productId: inventory.productId,
          color: inventory.color,
          size: inventory.size,
          movementDate: new Date().toISOString().split('T')[0],
          movementType: INVENTORY_MOVEMENT_TYPE.INITIAL_STOCK,
          quantity: row.quantity,
          quantityChanged: row.quantity,
          previousQuantity: 0,
          newQuantity: row.quantity,
          notes: 'Initial inventory seed',
          referenceType: INVENTORY_REFERENCE_TYPE.SEED,
          referenceId: inventory.id,
          referenceNumber: inventory.id,
          performedBy: INVENTORY_PERFORMED_BY.SYSTEM,
        },
        create: {
          id: `initial-stock-${inventory.id}`,
          itemType: 'PRODUCT',
          inventoryId: inventory.id,
          productId: inventory.productId,
          color: inventory.color,
          size: inventory.size,
          movementDate: new Date().toISOString().split('T')[0],
          movementType: INVENTORY_MOVEMENT_TYPE.INITIAL_STOCK,
          quantity: row.quantity,
          quantityChanged: row.quantity,
          previousQuantity: 0,
          newQuantity: row.quantity,
          notes: 'Initial inventory seed',
          referenceType: INVENTORY_REFERENCE_TYPE.SEED,
          referenceId: inventory.id,
          referenceNumber: inventory.id,
          performedBy: INVENTORY_PERFORMED_BY.SYSTEM,
        },
      });
    }
  }

  console.log('Deterministic inventory seeded successfully.');
  console.log(`Inventory rows: ${INVENTORY_ROWS.length}`);
}

// ─── Standalone execution (tsx prisma/seeds/inventory.seed.js) ──────────────
const prisma = new PrismaClient();
seedInventory(prisma)
  .catch((error) => {
    console.error('Deterministic inventory seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

export { seedInventory, INVENTORY_ROWS };
