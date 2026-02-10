import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type { BusinessRecord } from "../../shared/models.js";

export interface CreateBusinessParams {
  name: string;
  ownerUserId: string;
  contactEmail: string | null;
}

export interface BusinessesRepository {
  list(): BusinessRecord[];
  create(params: CreateBusinessParams): BusinessRecord;
}

export class InMemoryBusinessesRepository implements BusinessesRepository {
  constructor(private readonly store: MemoryStore) {}

  list(): BusinessRecord[] {
    return [...this.store.businesses];
  }

  create(params: CreateBusinessParams): BusinessRecord {
    const timestamp = nowIso();
    const business: BusinessRecord = {
      id: createId("biz"),
      name: params.name,
      ownerUserId: params.ownerUserId,
      contactEmail: params.contactEmail,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.store.businesses.push(business);
    return business;
  }
}
