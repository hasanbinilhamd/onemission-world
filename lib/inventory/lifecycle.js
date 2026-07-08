import { v4 as uuid } from 'uuid';

export const DEFAULT_INVENTORY_THRESHOLD = 5;

export function normalizeInventoryDimensionValues(values = []) {
  const uniqueValues = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
      continue;
    }

    uniqueValues.add(normalizedValue);
  }

  return [...uniqueValues];
}

export function buildInventoryVariantRows({
  productId,
  colors = [],
  sizes = [],
  threshold = DEFAULT_INVENTORY_THRESHOLD,
}) {
  const normalizedProductId = String(productId || '').trim();
  const normalizedColors = normalizeInventoryDimensionValues(colors);
  const normalizedSizes = normalizeInventoryDimensionValues(sizes);

  if (!normalizedProductId || normalizedColors.length === 0 || normalizedSizes.length === 0) {
    return [];
  }

  const rows = [];

  for (const color of normalizedColors) {
    for (const size of normalizedSizes) {
      rows.push({
        id: uuid(),
        productId: normalizedProductId,
        color,
        size,
        quantity: 0,
        threshold,
        incoming: 0,
      });
    }
  }

  return rows;
}

export async function ensureInventoryRowsForProduct(prismaClient, {
  productId,
  colors = [],
  sizes = [],
  threshold = DEFAULT_INVENTORY_THRESHOLD,
}) {
  const rows = buildInventoryVariantRows({
    productId,
    colors,
    sizes,
    threshold,
  });

  if (rows.length === 0) {
    return {
      created: 0,
      totalCandidates: 0,
    };
  }

  const result = await prismaClient.inventory.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return {
    created: result.count,
    totalCandidates: rows.length,
  };
}

export async function repairAllProductInventoryRows(prismaClient, {
  products,
  threshold = DEFAULT_INVENTORY_THRESHOLD,
}) {
  const inventoryRows = [];

  for (const product of Array.isArray(products) ? products : []) {
    inventoryRows.push(
      ...buildInventoryVariantRows({
        productId: product.id,
        colors: product.colors,
        sizes: product.sizes,
        threshold,
      }),
    );
  }

  if (inventoryRows.length === 0) {
    return {
      created: 0,
      repaired: Array.isArray(products) ? products.length : 0,
      totalCandidates: 0,
    };
  }

  const result = await prismaClient.inventory.createMany({
    data: inventoryRows,
    skipDuplicates: true,
  });

  return {
    created: result.count,
    repaired: Array.isArray(products) ? products.length : 0,
    totalCandidates: inventoryRows.length,
  };
}
