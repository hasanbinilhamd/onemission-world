import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PRODUCT_UDEL_OFF_LEGGING_ID = '05f9c1f5-fdbd-4d9a-9a46-10ed5840d612';
const PRODUCT_COWBOY_RUNNING_CAP_ID = '375c0877-d96d-495c-9162-dd32cce343fc';
const PRODUCT_BASIC_LONG_LEGGING_ID = '812e5b24-d521-4c89-a9d9-dcad32fda52d';
const PRODUCT_FLEX_POCKET_LEGGING_ID = '8e46a914-e6df-497e-839e-773c56712f90';
const PRODUCT_PRO_SPORT_LEGGING_ID = 'd733f404-54e9-444d-b4c7-72cd49700ac3';
const PRODUCT_BASIC_THREE_QUARTER_LEGGING_ID = 'f64f0ae0-5df3-42fa-8df9-a8370e894123';

async function main() {
  console.log('Seeding deterministic products...');

  await prisma.product.upsert({
    where: { id: PRODUCT_UDEL_OFF_LEGGING_ID },
    update: {
      name: 'UDEL OFF LEGGING',
      sku: 'UO-OM',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 79350,
      sellingPrice: 189000,
      description: 'Recovery-focused performance legging designed with a relaxed compression feel to support muscle relaxation, comfort, and post-training recovery and cover Navel',
      tags: [],
      colors: ['Black'],
      sizes: ['L', '3XL'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/udel-off.svg?updatedAt=1782103585707',
    },
    create: {
      id: PRODUCT_UDEL_OFF_LEGGING_ID,
      name: 'UDEL OFF LEGGING',
      sku: 'UO-OM',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 79350,
      sellingPrice: 189000,
      description: 'Recovery-focused performance legging designed with a relaxed compression feel to support muscle relaxation, comfort, and post-training recovery and cover Navel',
      tags: [],
      colors: ['Black'],
      sizes: ['L', '3XL'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/udel-off.svg?updatedAt=1782103585707',
    },
  });

  await prisma.product.upsert({
    where: { id: PRODUCT_COWBOY_RUNNING_CAP_ID },
    update: {
      name: 'COWBOY RUNNING CAP',
      sku: 'CR-OM',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 51750,
      sellingPrice: 119000,
      description: 'Ultra-lightweight running cap designed for maximum breathability, sun protection, and all-day comfort during training and outdoor activities.',
      tags: [],
      colors: ['Black'],
      sizes: ['AllSize'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/cowboy-running-hat.svg?updatedAt=1782103860220',
    },
    create: {
      id: PRODUCT_COWBOY_RUNNING_CAP_ID,
      name: 'COWBOY RUNNING CAP',
      sku: 'CR-OM',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 51750,
      sellingPrice: 119000,
      description: 'Ultra-lightweight running cap designed for maximum breathability, sun protection, and all-day comfort during training and outdoor activities.',
      tags: [],
      colors: ['Black'],
      sizes: ['AllSize'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/cowboy-running-hat.svg?updatedAt=1782103860220',
    },
  });

  await prisma.product.upsert({
    where: { id: PRODUCT_BASIC_LONG_LEGGING_ID },
    update: {
      name: 'BASIC LONG LEGGING',
      sku: 'BL-OM',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 35750,
      sellingPrice: 99000,
      description: 'Full-length performance legging designed to provide complete lower-body coverage, lasting comfort, and reliable support for every training session.',
      tags: [],
      colors: ['Black'],
      sizes: ['XL', '3XL', '5XL'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/basic-legging.svg?updatedAt=1782103618121',
    },
    create: {
      id: PRODUCT_BASIC_LONG_LEGGING_ID,
      name: 'BASIC LONG LEGGING',
      sku: 'BL-OM',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 35750,
      sellingPrice: 99000,
      description: 'Full-length performance legging designed to provide complete lower-body coverage, lasting comfort, and reliable support for every training session.',
      tags: [],
      colors: ['Black'],
      sizes: ['XL', '3XL', '5XL'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/basic-legging.svg?updatedAt=1782103618121',
    },
  });

  await prisma.product.upsert({
    where: { id: PRODUCT_FLEX_POCKET_LEGGING_ID },
    update: {
      name: 'FLEX POCKET LEGGING',
      sku: 'OM-FP',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 62600,
      sellingPrice: 169000,
      description: 'Engineered with performance compression and secure side pockets, allowing Muslim athletes to train freely without sacrificing functionality or values.',
      tags: [],
      colors: ['Black'],
      sizes: ['L', '2XL'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/flexpocket-legging.svg?updatedAt=1782103554918',
    },
    create: {
      id: PRODUCT_FLEX_POCKET_LEGGING_ID,
      name: 'FLEX POCKET LEGGING',
      sku: 'OM-FP',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 62600,
      sellingPrice: 169000,
      description: 'Engineered with performance compression and secure side pockets, allowing Muslim athletes to train freely without sacrificing functionality or values.',
      tags: [],
      colors: ['Black'],
      sizes: ['L', '2XL'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/flexpocket-legging.svg?updatedAt=1782103554918',
    },
  });

  await prisma.product.upsert({
    where: { id: PRODUCT_PRO_SPORT_LEGGING_ID },
    update: {
      name: 'PRO SPORT LEGGING',
      sku: 'PS-OM',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 76600,
      sellingPrice: 199000,
      description: 'High-performance compression legging engineered for serious athletes, delivering enhanced muscle support, stability, and endurance during intense training sessions.',
      tags: [],
      colors: ['Black'],
      sizes: ['L', '2XL'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/prosport-legging.svg?updatedAt=1782103636717',
    },
    create: {
      id: PRODUCT_PRO_SPORT_LEGGING_ID,
      name: 'PRO SPORT LEGGING',
      sku: 'PS-OM',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 76600,
      sellingPrice: 199000,
      description: 'High-performance compression legging engineered for serious athletes, delivering enhanced muscle support, stability, and endurance during intense training sessions.',
      tags: [],
      colors: ['Black'],
      sizes: ['L', '2XL'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/prosport-legging.svg?updatedAt=1782103636717',
    },
  });

  await prisma.product.upsert({
    where: { id: PRODUCT_BASIC_THREE_QUARTER_LEGGING_ID },
    update: {
      name: 'BASIC 3/4 LEGGING',
      sku: 'B3/4-OM',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 34800,
      sellingPrice: 89000,
      description: 'Essential 3/4 performance legging designed to deliver lightweight muscle support, unrestricted movement, and comfortable coverage for everyday training.',
      tags: [],
      colors: ['Black'],
      sizes: ['XL', '3XL', '5XL'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/3per4-legging.svg?updatedAt=1782103601573',
    },
    create: {
      id: PRODUCT_BASIC_THREE_QUARTER_LEGGING_ID,
      name: 'BASIC 3/4 LEGGING',
      sku: 'B3/4-OM',
      category: 'Compression Pants',
      brand: 'onemission',
      status: 'Active',
      costPrice: 34800,
      sellingPrice: 89000,
      description: 'Essential 3/4 performance legging designed to deliver lightweight muscle support, unrestricted movement, and comfortable coverage for everyday training.',
      tags: [],
      colors: ['Black'],
      sizes: ['XL', '3XL', '5XL'],
      notes: '',
      imageUrl: 'https://ik.imagekit.io/edyl3oplm/Onemission/products/3per4-legging.svg?updatedAt=1782103601573',
    },
  });

  console.log('Deterministic products seeded successfully.');
  console.log(`Product ID: ${PRODUCT_UDEL_OFF_LEGGING_ID}`);
  console.log(`Product ID: ${PRODUCT_COWBOY_RUNNING_CAP_ID}`);
  console.log(`Product ID: ${PRODUCT_BASIC_LONG_LEGGING_ID}`);
  console.log(`Product ID: ${PRODUCT_FLEX_POCKET_LEGGING_ID}`);
  console.log(`Product ID: ${PRODUCT_PRO_SPORT_LEGGING_ID}`);
  console.log(`Product ID: ${PRODUCT_BASIC_THREE_QUARTER_LEGGING_ID}`);
}

main()
  .catch((error) => {
    console.error('Deterministic product seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
