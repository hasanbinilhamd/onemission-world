export function aggregateManualOrderInventoryQuantities(items = []) {
  const totals = new Map();

  for (const item of items) {
    const inventoryId = String(item?.inventoryId || '').trim();
    const quantity = Number(item?.quantity || 0);
    if (!inventoryId) continue;
    totals.set(inventoryId, Number(totals.get(inventoryId) || 0) + quantity);
  }

  return totals;
}

export function validateManualOrderInventoryAvailability({ requestedByInventory = new Map(), inventoryRows = [] } = {}) {
  const inventoryById = new Map(inventoryRows.map((row) => [row.id, row]));

  for (const [inventoryId, requestedQuantity] of requestedByInventory.entries()) {
    const inventory = inventoryById.get(inventoryId);
    if (!inventory) {
      return { valid: false, inventoryId, message: 'Selected inventory variant is invalid.' };
    }

    if (Number(inventory.quantity || 0) < Number(requestedQuantity || 0)) {
      const productName = inventory.product?.name || 'selected item';
      return {
        valid: false,
        inventoryId,
        message: `Insufficient inventory for ${productName} ${inventory.color || ''} ${inventory.size || ''}.`,
      };
    }
  }

  return { valid: true, inventoryId: '', message: '' };
}
