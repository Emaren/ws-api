import type {
  BusinessOpsEntityMap,
  BusinessOpsEntityName,
} from "./business-ops.types.js";

type Predicate<T> = (record: T) => boolean;

interface EntityTable<T extends { id: string }> {
  byId: Map<string, T>;
}

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

function createEntityTables(): {
  [K in BusinessOpsEntityName]: EntityTable<BusinessOpsEntityMap[K]>;
} {
  return {
    businesses: { byId: new Map() },
    storeProfiles: { byId: new Map() },
    inventoryItems: { byId: new Map() },
    pricingRules: { byId: new Map() },
    offers: { byId: new Map() },
    campaigns: { byId: new Map() },
    notificationRecipients: { byId: new Map() },
    deliveryLeads: { byId: new Map() },
    affiliateClicks: { byId: new Map() },
    rewardLedger: { byId: new Map() },
  };
}

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

export class InMemoryBusinessOpsRepository implements BusinessOpsRepository {
  private readonly tables = createEntityTables();

  list<K extends BusinessOpsEntityName>(entity: K): BusinessOpsEntityMap[K][] {
    const table = this.tables[entity];
    return [...table.byId.values()];
  }

  getById<K extends BusinessOpsEntityName>(entity: K, id: string): BusinessOpsEntityMap[K] | undefined {
    return this.tables[entity].byId.get(id);
  }

  create<K extends BusinessOpsEntityName>(entity: K, record: BusinessOpsEntityMap[K]): BusinessOpsEntityMap[K] {
    this.tables[entity].byId.set(record.id, record);
    return record;
  }

  update<K extends BusinessOpsEntityName>(
    entity: K,
    id: string,
    updater: (existing: BusinessOpsEntityMap[K]) => BusinessOpsEntityMap[K],
  ): BusinessOpsEntityMap[K] | undefined {
    const current = this.tables[entity].byId.get(id);
    if (!current) {
      return undefined;
    }

    const next = updater(current);
    this.tables[entity].byId.set(id, next);
    return next;
  }

  delete<K extends BusinessOpsEntityName>(entity: K, id: string): BusinessOpsEntityMap[K] | undefined {
    const current = this.tables[entity].byId.get(id);
    if (!current) {
      return undefined;
    }

    this.tables[entity].byId.delete(id);
    return current;
  }

  findFirst<K extends BusinessOpsEntityName>(
    entity: K,
    predicate: Predicate<BusinessOpsEntityMap[K]>,
  ): BusinessOpsEntityMap[K] | undefined {
    for (const record of this.tables[entity].byId.values()) {
      if (predicate(record)) {
        return record;
      }
    }

    return undefined;
  }

  count<K extends BusinessOpsEntityName>(entity: K): number {
    return this.tables[entity].byId.size;
  }

  counts(): Record<BusinessOpsEntityName, number> {
    const output = {} as Record<BusinessOpsEntityName, number>;
    for (const entity of ENTITY_NAMES) {
      output[entity] = this.tables[entity].byId.size;
    }

    return output;
  }
}
