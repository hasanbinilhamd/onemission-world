import { prisma } from '@/lib/prisma';

function normalizeString(value) {
  return String(value || '').trim();
}

export class InventoryValuationService {
  constructor({ prismaClient = prisma } = {}) {
    this.prisma = prismaClient;
  }

  async buildReport({ search = '' } = {}) {
    const normalizedSearch = normalizeString(search).toLowerCase();

    const [products, inventoryRows] = await Promise.all([
      this.prisma.product.findMany({
        orderBy: { name: 'asc' },
      }),
      this.prisma.inventory.findMany(),
    ]);

    const inventoryByProductId = new Map();
    for (const inventory of inventoryRows) {
      const current = inventoryByProductId.get(inventory.productId) || 0;
      inventoryByProductId.set(inventory.productId, current + Number(inventory.quantity || 0));
    }

    const rows = products
      .map((product) => {
        const currentStock = Number(inventoryByProductId.get(product.id) || 0);
        const costPrice = Number(product.costPrice || 0);
        return {
          id: product.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock,
          costPrice,
          inventoryValue: currentStock * costPrice,
        };
      })
      .filter((row) => {
        if (!normalizedSearch) {
          return row.currentStock > 0 || row.inventoryValue > 0;
        }

        const haystack = `${row.productName} ${row.sku}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((left, right) => left.productName.localeCompare(right.productName));

    return {
      rows,
      totalInventoryValue: rows.reduce((sum, row) => sum + row.inventoryValue, 0),
      totalProducts: rows.length,
      totalUnits: rows.reduce((sum, row) => sum + row.currentStock, 0),
    };
  }
}

export const inventoryValuationService = new InventoryValuationService();
