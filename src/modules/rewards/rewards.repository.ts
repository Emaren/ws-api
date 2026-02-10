import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type { RewardLedgerEntryRecord, RewardToken } from "../../shared/models.js";

export interface CreateRewardEntryParams {
  userId: string;
  token: RewardToken;
  amount: number;
  reason: string;
  metadata: string | null;
}

export interface RewardsRepository {
  listEntries(): RewardLedgerEntryRecord[];
  createEntry(params: CreateRewardEntryParams): RewardLedgerEntryRecord;
}

export class InMemoryRewardsRepository implements RewardsRepository {
  constructor(private readonly store: MemoryStore) {}

  listEntries(): RewardLedgerEntryRecord[] {
    return [...this.store.rewardLedger];
  }

  createEntry(params: CreateRewardEntryParams): RewardLedgerEntryRecord {
    const entry: RewardLedgerEntryRecord = {
      id: createId("rwd"),
      userId: params.userId,
      token: params.token,
      amount: params.amount,
      reason: params.reason,
      metadata: params.metadata,
      createdAt: nowIso(),
    };

    this.store.rewardLedger.push(entry);
    return entry;
  }
}
