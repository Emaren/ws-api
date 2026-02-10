import type {
  ArticleRecord,
  BillingCustomerRecord,
  BusinessRecord,
  InventoryItemRecord,
  NotificationJobRecord,
  RewardLedgerEntryRecord,
  UserRecord,
} from "../../shared/models.js";

export interface MemoryStore {
  users: UserRecord[];
  articles: ArticleRecord[];
  businesses: BusinessRecord[];
  inventoryItems: InventoryItemRecord[];
  notifications: NotificationJobRecord[];
  billingCustomers: BillingCustomerRecord[];
  rewardLedger: RewardLedgerEntryRecord[];
}

export function createMemoryStore(): MemoryStore {
  return {
    users: [],
    articles: [],
    businesses: [],
    inventoryItems: [],
    notifications: [],
    billingCustomers: [],
    rewardLedger: [],
  };
}
