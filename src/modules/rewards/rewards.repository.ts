import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type {
  RewardLedgerEntryRecord,
  RewardPayoutStatus,
  RewardRuleId,
  RewardToken,
} from "../../shared/models.js";

export interface CreateRewardEntryParams {
  userId: string;
  token: RewardToken;
  amount: number;
  reason: string;
  ruleId: RewardRuleId;
  sourceType: string | null;
  sourceId: string | null;
  idempotencyKey: string | null;
  metadata: Record<string, unknown> | null;
  payoutStatus?: RewardPayoutStatus;
}

export interface RewardEntryFilters {
  userId?: string | undefined;
  token?: RewardToken | undefined;
  ruleId?: RewardRuleId | undefined;
  payoutStatus?: RewardPayoutStatus | undefined;
  createdAfter?: string | undefined;
  createdBefore?: string | undefined;
}

export interface RewardsRepository {
  listEntries(filters?: RewardEntryFilters): RewardLedgerEntryRecord[];
  findById(id: string): RewardLedgerEntryRecord | undefined;
  findByIdempotencyKey(userId: string, idempotencyKey: string): RewardLedgerEntryRecord | undefined;
  findLatestByUserRule(userId: string, ruleId: RewardRuleId): RewardLedgerEntryRecord | undefined;
  findByUserRuleSource(
    userId: string,
    ruleId: RewardRuleId,
    sourceId: string,
  ): RewardLedgerEntryRecord | undefined;
  sumUserTokenInWindow(userId: string, token: RewardToken, startIso: string, endIso: string): number;
  createEntry(params: CreateRewardEntryParams): RewardLedgerEntryRecord;
  markEntriesExported(entryIds: string[], payoutBatchId: string): RewardLedgerEntryRecord[];
  markEntriesPaid(entryIds: string[], payoutBatchId: string, payoutTxHash: string): RewardLedgerEntryRecord[];
}

function sortNewestFirst(entries: RewardLedgerEntryRecord[]): RewardLedgerEntryRecord[] {
  return [...entries].sort((left, right) =>
    left.createdAt < right.createdAt ? 1 : left.createdAt > right.createdAt ? -1 : 0,
  );
}

export class InMemoryRewardsRepository implements RewardsRepository {
  constructor(private readonly store: MemoryStore) {}

  listEntries(filters?: RewardEntryFilters): RewardLedgerEntryRecord[] {
    const createdAfterMs = filters?.createdAfter ? new Date(filters.createdAfter).getTime() : null;
    const createdBeforeMs = filters?.createdBefore
      ? new Date(filters.createdBefore).getTime()
      : null;

    const filtered = this.store.rewardLedger.filter((entry) => {
      if (filters?.userId && entry.userId !== filters.userId) {
        return false;
      }

      if (filters?.token && entry.token !== filters.token) {
        return false;
      }

      if (filters?.ruleId && entry.ruleId !== filters.ruleId) {
        return false;
      }

      if (filters?.payoutStatus && entry.payoutStatus !== filters.payoutStatus) {
        return false;
      }

      const createdAtMs = new Date(entry.createdAt).getTime();
      if (
        createdAfterMs !== null &&
        Number.isFinite(createdAfterMs) &&
        Number.isFinite(createdAtMs) &&
        createdAtMs < createdAfterMs
      ) {
        return false;
      }

      if (
        createdBeforeMs !== null &&
        Number.isFinite(createdBeforeMs) &&
        Number.isFinite(createdAtMs) &&
        createdAtMs > createdBeforeMs
      ) {
        return false;
      }

      return true;
    });

    return sortNewestFirst(filtered);
  }

  findById(id: string): RewardLedgerEntryRecord | undefined {
    return this.store.rewardLedger.find((entry) => entry.id === id);
  }

  findByIdempotencyKey(userId: string, idempotencyKey: string): RewardLedgerEntryRecord | undefined {
    return this.store.rewardLedger.find(
      (entry) => entry.userId === userId && entry.idempotencyKey === idempotencyKey,
    );
  }

  findLatestByUserRule(userId: string, ruleId: RewardRuleId): RewardLedgerEntryRecord | undefined {
    const matches = this.store.rewardLedger.filter(
      (entry) => entry.userId === userId && entry.ruleId === ruleId,
    );

    const sorted = sortNewestFirst(matches);
    return sorted[0];
  }

  findByUserRuleSource(
    userId: string,
    ruleId: RewardRuleId,
    sourceId: string,
  ): RewardLedgerEntryRecord | undefined {
    return this.store.rewardLedger.find(
      (entry) =>
        entry.userId === userId &&
        entry.ruleId === ruleId &&
        entry.sourceId === sourceId &&
        entry.payoutStatus !== "VOID",
    );
  }

  sumUserTokenInWindow(userId: string, token: RewardToken, startIso: string, endIso: string): number {
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();

    return this.store.rewardLedger.reduce((total, entry) => {
      if (entry.userId !== userId || entry.token !== token || entry.payoutStatus === "VOID") {
        return total;
      }

      const createdAtMs = new Date(entry.createdAt).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !Number.isFinite(createdAtMs)) {
        return total;
      }

      if (createdAtMs < startMs || createdAtMs > endMs) {
        return total;
      }

      return total + entry.amount;
    }, 0);
  }

  createEntry(params: CreateRewardEntryParams): RewardLedgerEntryRecord {
    const timestamp = nowIso();
    const entry: RewardLedgerEntryRecord = {
      id: createId("rwd"),
      userId: params.userId,
      token: params.token,
      amount: params.amount,
      reason: params.reason,
      ruleId: params.ruleId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
      payoutStatus: params.payoutStatus ?? "PENDING",
      payoutBatchId: null,
      payoutTxHash: null,
      exportedAt: null,
      settledAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.store.rewardLedger.push(entry);
    return entry;
  }

  markEntriesExported(entryIds: string[], payoutBatchId: string): RewardLedgerEntryRecord[] {
    const now = nowIso();
    const idSet = new Set(entryIds);

    const updated: RewardLedgerEntryRecord[] = [];
    for (const entry of this.store.rewardLedger) {
      if (!idSet.has(entry.id)) {
        continue;
      }

      if (entry.payoutStatus !== "PENDING") {
        continue;
      }

      entry.payoutStatus = "EXPORTED";
      entry.payoutBatchId = payoutBatchId;
      entry.exportedAt = now;
      entry.updatedAt = now;
      updated.push(entry);
    }

    return updated;
  }

  markEntriesPaid(entryIds: string[], payoutBatchId: string, payoutTxHash: string): RewardLedgerEntryRecord[] {
    const now = nowIso();
    const idSet = new Set(entryIds);

    const updated: RewardLedgerEntryRecord[] = [];
    for (const entry of this.store.rewardLedger) {
      if (!idSet.has(entry.id)) {
        continue;
      }

      if (entry.payoutStatus !== "EXPORTED") {
        continue;
      }

      if (entry.payoutBatchId !== payoutBatchId) {
        continue;
      }

      entry.payoutStatus = "PAID";
      entry.payoutBatchId = payoutBatchId;
      entry.payoutTxHash = payoutTxHash;
      entry.settledAt = now;
      entry.updatedAt = now;
      updated.push(entry);
    }

    return updated;
  }
}
