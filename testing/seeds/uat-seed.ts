import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CUSTOMER_ID = 'uat-customer-john-doe';
const SALES_CHANNEL_ID = 'uat-sales-channel-website';
const PRODUCT_ID = 'uat-product-training-jersey';
const VARIANT_ID = 'uat-variant-training-jersey-black-xl';

async function main() {
  console.log('Seeding UAT data...');

  await prisma.salesChannel.upsert({
    where: { id: SALES_CHANNEL_ID },
    update: {
      channelCode: 'SC-UAT-WEB',
      channelName: 'Website',
      channelType: 'Ecommerce',
      description: 'Deterministic UAT sales channel',
      status: 'Active',
      isDefault: true,
    },
    create: {
      id: SALES_CHANNEL_ID,
      channelCode: 'SC-UAT-WEB',
      channelName: 'Website',
      channelType: 'Ecommerce',
      description: 'Deterministic UAT sales channel',
      status: 'Active',
      isDefault: true,
    },
  });

  await prisma.customer.upsert({
    where: { id: CUSTOMER_ID },
    update: {
      customerCode: 'CUS-UAT-001',
      customerName: 'John Doe',
      email: 'john@example.com',
      phone: '+628123456789',
      customerType: 'Individual',
      preferredSalesChannelId: SALES_CHANNEL_ID,
      city: 'Bandung',
      province: 'Jawa Barat',
      country: 'Indonesia',
      notes: 'Deterministic UAT customer',
      status: 'Active',
    },
    create: {
      id: CUSTOMER_ID,
      customerCode: 'CUS-UAT-001',
      customerName: 'John Doe',
      email: 'john@example.com',
      phone: '+628123456789',
      customerType: 'Individual',
      preferredSalesChannelId: SALES_CHANNEL_ID,
      city: 'Bandung',
      province: 'Jawa Barat',
      country: 'Indonesia',
      notes: 'Deterministic UAT customer',
      status: 'Active',
    },
  });

  await prisma.product.upsert({
    where: { id: PRODUCT_ID },
    update: {
      name: 'Training Jersey',
      sku: 'OM-TSHIRT-BLK-XL',
      category: 'Apparel',
      brand: 'ONEMISSION',
      status: 'Active',
      costPrice: 120000,
      sellingPrice: 250000,
      description: 'Deterministic UAT training jersey product.',
      tags: ['uat', 'training-jersey'],
      colors: ['Black'],
      sizes: ['XL'],
      notes: 'Seeded for UAT flow',
      imageUrl: 'https://example.com/uat/training-jersey-black-xl.png',
    },
    create: {
      id: PRODUCT_ID,
      name: 'Training Jersey',
      sku: 'OM-TSHIRT-BLK-XL',
      category: 'Apparel',
      brand: 'ONEMISSION',
      status: 'Active',
      costPrice: 120000,
      sellingPrice: 250000,
      description: 'Deterministic UAT training jersey product.',
      tags: ['uat', 'training-jersey'],
      colors: ['Black'],
      sizes: ['XL'],
      notes: 'Seeded for UAT flow',
      imageUrl: 'https://example.com/uat/training-jersey-black-xl.png',
    },
  });

  await prisma.inventory.upsert({
    where: { id: VARIANT_ID },
    update: {
      productId: PRODUCT_ID,
      color: 'Black',
      size: 'XL',
      quantity: 20,
      threshold: 5,
      incoming: 0,
      status: 'Active',
    },
    create: {
      id: VARIANT_ID,
      productId: PRODUCT_ID,
      color: 'Black',
      size: 'XL',
      quantity: 20,
      threshold: 5,
      incoming: 0,
      status: 'Active',
    },
  });

  console.log('UAT data seeded successfully.');
  console.log(`Customer ID: ${CUSTOMER_ID}`);
  console.log(`Sales Channel ID: ${SALES_CHANNEL_ID}`);
  console.log(`Product ID: ${PRODUCT_ID}`);
  console.log(`Variant ID: ${VARIANT_ID}`);
}

main()
  .catch((error) => {
    console.error('UAT seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
