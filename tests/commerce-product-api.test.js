import test from 'node:test';
import assert from 'node:assert/strict';
import { CommerceProductService } from '../lib/commerce/service.js';
import { CommerceProductError } from '../lib/commerce/errors.js';

function createService(products) {
  const prismaClient = {
    product: {
      findMany: async ({ where, select } = {}) => {
        const filtered = (products || []).filter((product) => {
          if (where?.status && product.status !== where.status) {
            return false;
          }

          if (where?.id && product.id !== where.id) {
            return false;
          }

          return true;
        });

        if (select?.id && select?.name && !select?.sku) {
          return filtered.map((product) => ({
            id: product.id,
            name: product.name,
          }));
        }

        return filtered;
      },
      findFirst: async ({ where } = {}) => {
        return (products || []).find((product) => {
          if (where?.status && product.status !== where.status) {
            return false;
          }

          if (where?.id && product.id !== where.id) {
            return false;
          }

          return true;
        }) || null;
      },
    },
  };

  return new CommerceProductService({ prismaClient });
}

const baseUrl = 'https://hq.onemission.world';

const products = [
  {
    id: 'product-1',
    name: 'Training Jersey Black',
    sku: 'OM-JS-003',
    category: 'Jerseys',
    status: 'Active',
    sellingPrice: 199000,
    description: 'Lightweight breathable jersey for performance training.',
    tags: ['jersey'],
    notes: 'Best seller Q1 2026.',
    imageUrl: '/images/jersey-black.png',
    inventory: [
      { id: 'variant-1', color: 'Black', size: 'XL', quantity: 6, status: 'Active' },
      { id: 'variant-2', color: 'White', size: 'L', quantity: 0, status: 'Active' },
    ],
  },
  {
    id: 'product-2',
    name: 'Performance Cap',
    sku: 'OM-AC-005',
    category: 'Accessories',
    status: 'Active',
    sellingPrice: 99000,
    description: 'Lightweight performance cap.',
    tags: ['cap'],
    notes: '',
    imageUrl: '',
    inventory: [
      { id: 'variant-3', color: 'Black', size: 'One Size', quantity: 0, status: 'Active' },
    ],
  },
  {
    id: 'product-3',
    name: 'Archived Product',
    sku: 'OM-AR-999',
    category: 'Accessories',
    status: 'Archived',
    sellingPrice: 1000,
    description: 'Should never appear.',
    tags: [],
    notes: '',
    imageUrl: '',
    inventory: [
      { id: 'variant-4', color: 'Black', size: 'Default', quantity: 100, status: 'Active' },
    ],
  },
];

test('lists storefront products without exposing internal fields', async () => {
  const service = createService(products.filter((product) => product.status === 'Active'));
  const response = await service.listProducts({ query: { page: '1', limit: '12' }, baseUrl });

  assert.equal(response.data.length, 2);
  assert.equal(response.data[0].slug, 'performance-cap');
  assert.equal(response.data[0].thumbnail, 'https://hq.onemission.world/icon.svg');
  assert.ok(!('notes' in response.data[0]));
  assert.ok(!('tags' in response.data[0]));
});

test('filters featured and in-stock products correctly', async () => {
  const service = createService(products.filter((product) => product.status === 'Active'));
  const response = await service.listProducts({
    query: { featured: 'true', inStock: 'true' },
    baseUrl,
  });

  assert.equal(response.data.length, 1);
  assert.equal(response.data[0].name, 'Training Jersey Black');
  assert.equal(response.data[0].stockStatus, 'IN_STOCK');
});

test('returns product detail by slug with active variants only', async () => {
  const service = createService(products.filter((product) => product.status === 'Active'));
  const response = await service.getProductBySlug({ slug: 'training-jersey-black', baseUrl });

  assert.equal(response.data.slug, 'training-jersey-black');
  assert.equal(response.data.availableVariants.length, 2);
  assert.equal(response.data.availableSizes.length, 1);
  assert.equal(response.data.availableSizes[0], 'XL');
  assert.equal(response.data.availableColors[0], 'Black');
  assert.equal(response.data.currentStock, 6);
  assert.equal(response.data.thumbnail, 'https://hq.onemission.world/images/jersey-black.png');
});

test('returns storefront categories derived from published products', async () => {
  const service = createService(products.filter((product) => product.status === 'Active'));
  const response = await service.listCategories({ baseUrl });

  assert.equal(response.data.length, 2);
  assert.equal(response.data[0].productCount, 1);
});

test('throws not found for missing commerce slug', async () => {
  const service = createService(products.filter((product) => product.status === 'Active'));

  await assert.rejects(
    service.getProductBySlug({ slug: 'missing-product', baseUrl }),
    (error) => error instanceof CommerceProductError && error.code === 'COMMERCE_PRODUCT_NOT_FOUND',
  );
});
