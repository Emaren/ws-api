import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type { InventoryItemRecord } from "../../shared/models.js";

export interface CreateInventoryItemParams {
  businessId: string;
  name: string;
  priceCents: number;
  discountedPriceCents: number | null;
  discountEndsAt: string | null;
  unitsLeft: number;
}

export interface InventoryRepository {
  list(): InventoryItemRecord[];
  create(params: CreateInventoryItemParams): InventoryItemRecord;
}

export class InMemoryInventoryRepository implements InventoryRepository {
  constructor(private readonly store: MemoryStore) {}

  list(): InventoryItemRecord[] {
    return [...this.store.inventoryItems];
  }

  create(params: CreateInventoryItemParams): InventoryItemRecord {
    const timestamp = nowIso();
    const item: InventoryItemRecord = {
      id: createId("inv"),
      businessId: params.businessId,
      name: params.name,
      priceCents: params.priceCents,
      discountedPriceCents: params.discountedPriceCents,
      discountEndsAt: params.discountEndsAt,
      unitsLeft: params.unitsLeft,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.store.inventoryItems.push(item);
    return item;
  }
}
