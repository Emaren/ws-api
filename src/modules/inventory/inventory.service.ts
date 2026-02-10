import { HttpError } from "../../shared/http-error.js";
import type { InventoryItemRecord } from "../../shared/models.js";
import type { InventoryRepository } from "./inventory.repository.js";

interface CreateInventoryItemInput {
  businessId: string;
  name: string;
  priceCents: number;
  discountedPriceCents: number | null;
  discountEndsAt: string;
  unitsLeft: number;
}

export class InventoryService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  listInventory(businessId?: string): InventoryItemRecord[] {
    const allItems = this.inventoryRepository.list();
    if (!businessId) {
      return allItems;
    }

    return allItems.filter((item) => item.businessId === businessId);
  }

  createInventoryItem(input: CreateInventoryItemInput): InventoryItemRecord {
    if (!input.businessId.trim() || !input.name.trim()) {
      throw new HttpError(400, "Missing businessId or item name");
    }

    if (!Number.isFinite(input.priceCents) || input.priceCents < 0) {
      throw new HttpError(400, "priceCents must be a positive integer");
    }

    if (!Number.isFinite(input.unitsLeft) || input.unitsLeft < 0) {
      throw new HttpError(400, "unitsLeft must be a non-negative integer");
    }

    const discounted =
      input.discountedPriceCents !== null && Number.isFinite(input.discountedPriceCents)
        ? input.discountedPriceCents
        : null;

    return this.inventoryRepository.create({
      businessId: input.businessId.trim(),
      name: input.name.trim(),
      priceCents: Math.trunc(input.priceCents),
      discountedPriceCents: discounted === null ? null : Math.trunc(discounted),
      discountEndsAt: input.discountEndsAt.trim() || null,
      unitsLeft: Math.trunc(input.unitsLeft),
    });
  }
}
