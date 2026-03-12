import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import type {
  BusinessOpsEntityMap,
  BusinessOpsEntityName,
} from "./business-ops.types.js";

type Predicate<T> = (record: T) => boolean;

const ENTITY_NAMES: BusinessOpsEntityName[] = [
  "businesses",
  "storeProfiles",
  "inventoryItems",
  "pricingRules",
  "offers",
  "campaigns",
  "notificationRecipients",
  "deliveryLeads",
  "affiliateClicks",
  "rewardLedger",
];

export interface BusinessOpsRepository {
  list<K extends BusinessOpsEntityName>(entity: K): BusinessOpsEntityMap[K][];
  getById<K extends BusinessOpsEntityName>(entity: K, id: string): BusinessOpsEntityMap[K] | undefined;
  create<K extends BusinessOpsEntityName>(entity: K, record: BusinessOpsEntityMap[K]): BusinessOpsEntityMap[K];
  update<K extends BusinessOpsEntityName>(
    entity: K,
    id: string,
    updater: (existing: BusinessOpsEntityMap[K]) => BusinessOpsEntityMap[K],
  ): BusinessOpsEntityMap[K] | undefined;
  delete<K extends BusinessOpsEntityName>(entity: K, id: string): BusinessOpsEntityMap[K] | undefined;
  findFirst<K extends BusinessOpsEntityName>(
    entity: K,
    predicate: Predicate<BusinessOpsEntityMap[K]>,
  ): BusinessOpsEntityMap[K] | undefined;
  count<K extends BusinessOpsEntityName>(entity: K): number;
  counts(): Record<BusinessOpsEntityName, number>;
}

export class StoreBackedBusinessOpsRepository implements BusinessOpsRepository {
  constructor(private readonly store: MemoryStore) {}

  private records<K extends BusinessOpsEntityName>(entity: K): BusinessOpsEntityMap[K][] {
    return this.store.businessOps[entity] as BusinessOpsEntityMap[K][];
  }

  list<K extends BusinessOpsEntityName>(entity: K): BusinessOpsEntityMap[K][] {
    return [...this.records(entity)];
  }

  getById<K extends BusinessOpsEntityName>(entity: K, id: string): BusinessOpsEntityMap[K] | undefined {
    return this.records(entity).find((record) => record.id === id);
  }

  create<K extends BusinessOpsEntityName>(entity: K, record: BusinessOpsEntityMap[K]): BusinessOpsEntityMap[K] {
    this.records(entity).push(record);
    return record;
  }

  update<K extends BusinessOpsEntityName>(
    entity: K,
    id: string,
    updater: (existing: BusinessOpsEntityMap[K]) => BusinessOpsEntityMap[K],
  ): BusinessOpsEntityMap[K] | undefined {
    const records = this.records(entity);
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) {
      return undefined;
    }

    const current = records[index];
    if (!current) {
      return undefined;
    }

    const next = updater(current);
    records[index] = next;
    return next;
  }

  delete<K extends BusinessOpsEntityName>(entity: K, id: string): BusinessOpsEntityMap[K] | undefined {
    const records = this.records(entity);
    const index = records.findIndex((record) => record.id === id);
    if (index === -1) {
      return undefined;
    }

    const [deleted] = records.splice(index, 1);
    return deleted;
  }

  findFirst<K extends BusinessOpsEntityName>(
    entity: K,
    predicate: Predicate<BusinessOpsEntityMap[K]>,
  ): BusinessOpsEntityMap[K] | undefined {
    return this.records(entity).find(predicate);
  }

  count<K extends BusinessOpsEntityName>(entity: K): number {
    return this.records(entity).length;
  }

  counts(): Record<BusinessOpsEntityName, number> {
    const output = {} as Record<BusinessOpsEntityName, number>;
    for (const entity of ENTITY_NAMES) {
      output[entity] = this.records(entity).length;
    }

    return output;
  }
}
