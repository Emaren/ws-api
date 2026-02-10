import type {
  ArticleRecord,
  AuthSessionRecord,
  BillingCustomerRecord,
  BusinessRecord,
  InventoryItemRecord,
  NotificationAuditLogRecord,
  NotificationJobRecord,
  RewardLedgerEntryRecord,
  WalletLinkChallengeRecord,
  WalletLinkRecord,
  UserRecord,
} from "../../shared/models.js";

export interface MemoryStore {
  users: UserRecord[];
  authSessions: AuthSessionRecord[];
  articles: ArticleRecord[];
  businesses: BusinessRecord[];
  inventoryItems: InventoryItemRecord[];
  notifications: NotificationJobRecord[];
  notificationAuditLogs: NotificationAuditLogRecord[];
  billingCustomers: BillingCustomerRecord[];
  rewardLedger: RewardLedgerEntryRecord[];
  walletLinks: WalletLinkRecord[];
  walletChallenges: WalletLinkChallengeRecord[];
}

export function createMemoryStore(): MemoryStore {
  return {
    users: [],
    authSessions: [],
    articles: [],
    businesses: [],
    inventoryItems: [],
    notifications: [],
    notificationAuditLogs: [],
    billingCustomers: [],
    rewardLedger: [],
    walletLinks: [],
    walletChallenges: [],
  };
}
