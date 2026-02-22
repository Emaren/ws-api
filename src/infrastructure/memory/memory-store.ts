import fs from "node:fs";
import path from "node:path";
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

function emptyStore(): MemoryStore {
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

function safeReadJson(filePath: string): unknown | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function coerceStore(value: unknown): MemoryStore {
  const base = emptyStore();
  if (!value || typeof value !== "object") return base;

  const obj = value as Record<string, unknown>;
  const arr = (k: keyof MemoryStore) => (Array.isArray(obj[k]) ? (obj[k] as any[]) : []);

  return {
    users: arr("users") as UserRecord[],
    authSessions: arr("authSessions") as AuthSessionRecord[],
    articles: arr("articles") as ArticleRecord[],
    businesses: arr("businesses") as BusinessRecord[],
    inventoryItems: arr("inventoryItems") as InventoryItemRecord[],
    notifications: arr("notifications") as NotificationJobRecord[],
    notificationAuditLogs: arr("notificationAuditLogs") as NotificationAuditLogRecord[],
    billingCustomers: arr("billingCustomers") as BillingCustomerRecord[],
    rewardLedger: arr("rewardLedger") as RewardLedgerEntryRecord[],
    walletLinks: arr("walletLinks") as WalletLinkRecord[],
    walletChallenges: arr("walletChallenges") as WalletLinkChallengeRecord[],
  };
}

function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const tmp = `${filePath}.tmp`;
  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(tmp, json, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

export function createMemoryStore(options?: {
  storePath?: string;
  flushIntervalMs?: number;
}): MemoryStore {
  const storePath = options?.storePath?.trim() || "";
  const flushIntervalMs = Math.max(1000, options?.flushIntervalMs ?? 5000);

  const store = storePath.length > 0 ? coerceStore(safeReadJson(storePath)) : emptyStore();

  if (storePath.length > 0) {
    const flush = () => {
      try {
        atomicWriteJson(storePath, store);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("ws-api store flush failed:", err);
      }
    };

    const timer = setInterval(flush, flushIntervalMs);

    timer.unref?.();

    const shutdown = () => {
      try {
        flush();
      } finally {
        clearInterval(timer);
      }
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  }

  return store;
}