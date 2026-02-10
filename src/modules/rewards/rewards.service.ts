import { HttpError } from "../../shared/http-error.js";
import type { RewardLedgerEntryRecord, RewardToken } from "../../shared/models.js";
import type { RewardsRepository } from "./rewards.repository.js";

const VALID_TOKENS: RewardToken[] = ["WHEAT", "STONE"];

interface CreateRewardInput {
  userId: string;
  token: string;
  amount: number;
  reason: string;
  metadata: string;
}

export class RewardsService {
  constructor(private readonly rewardsRepository: RewardsRepository) {}

  listEntries(userId?: string): RewardLedgerEntryRecord[] {
    const entries = this.rewardsRepository.listEntries();
    if (!userId) {
      return entries;
    }

    return entries.filter((entry) => entry.userId === userId);
  }

  addEntry(input: CreateRewardInput): RewardLedgerEntryRecord {
    if (!input.userId.trim() || !input.reason.trim()) {
      throw new HttpError(400, "Missing userId or reason");
    }

    if (!VALID_TOKENS.includes(input.token as RewardToken)) {
      throw new HttpError(400, "Invalid reward token");
    }

    if (!Number.isFinite(input.amount) || input.amount === 0) {
      throw new HttpError(400, "amount must be a non-zero number");
    }

    return this.rewardsRepository.createEntry({
      userId: input.userId.trim(),
      token: input.token as RewardToken,
      amount: input.amount,
      reason: input.reason.trim(),
      metadata: input.metadata.trim() || null,
    });
  }
}
