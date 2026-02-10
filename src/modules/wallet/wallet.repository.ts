import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type {
  WalletChainType,
  WalletLinkChallengeRecord,
  WalletLinkRecord,
} from "../../shared/models.js";

export interface CreateWalletChallengeParams {
  userId: string;
  chainType: WalletChainType;
  walletAddress: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface UpsertWalletLinkParams {
  userId: string;
  chainType: WalletChainType;
  walletAddress: string;
  walletAddressPrefix: string;
  publicKeyBase64: string;
  linkedAt: string;
  lastVerifiedAt: string;
}

export interface WalletRepository {
  findWalletByUserId(userId: string): WalletLinkRecord | undefined;
  findWalletByAddress(walletAddress: string): WalletLinkRecord | undefined;
  upsertWalletLink(params: UpsertWalletLinkParams): WalletLinkRecord;
  removeWalletByUserId(userId: string): WalletLinkRecord | undefined;

  createChallenge(params: CreateWalletChallengeParams): WalletLinkChallengeRecord;
  findChallengeById(challengeId: string): WalletLinkChallengeRecord | undefined;
  markChallengeUsed(challengeId: string): WalletLinkChallengeRecord | undefined;
  cleanupExpiredChallenges(nowIsoTimestamp: string): number;
}

export class InMemoryWalletRepository implements WalletRepository {
  constructor(private readonly store: MemoryStore) {}

  findWalletByUserId(userId: string): WalletLinkRecord | undefined {
    return this.store.walletLinks.find((candidate) => candidate.userId === userId);
  }

  findWalletByAddress(walletAddress: string): WalletLinkRecord | undefined {
    const normalized = walletAddress.trim().toLowerCase();
    return this.store.walletLinks.find(
      (candidate) => candidate.walletAddress.toLowerCase() === normalized,
    );
  }

  upsertWalletLink(params: UpsertWalletLinkParams): WalletLinkRecord {
    const existingByUser = this.findWalletByUserId(params.userId);
    const timestamp = nowIso();

    if (existingByUser) {
      existingByUser.chainType = params.chainType;
      existingByUser.walletAddress = params.walletAddress;
      existingByUser.walletAddressPrefix = params.walletAddressPrefix;
      existingByUser.publicKeyBase64 = params.publicKeyBase64;
      existingByUser.linkedAt = params.linkedAt;
      existingByUser.lastVerifiedAt = params.lastVerifiedAt;
      existingByUser.updatedAt = timestamp;
      return existingByUser;
    }

    const record: WalletLinkRecord = {
      id: createId("wal"),
      userId: params.userId,
      chainType: params.chainType,
      walletAddress: params.walletAddress,
      walletAddressPrefix: params.walletAddressPrefix,
      publicKeyBase64: params.publicKeyBase64,
      linkedAt: params.linkedAt,
      lastVerifiedAt: params.lastVerifiedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.store.walletLinks.push(record);
    return record;
  }

  removeWalletByUserId(userId: string): WalletLinkRecord | undefined {
    const index = this.store.walletLinks.findIndex((candidate) => candidate.userId === userId);
    if (index === -1) {
      return undefined;
    }

    const [removed] = this.store.walletLinks.splice(index, 1);
    return removed;
  }

  createChallenge(params: CreateWalletChallengeParams): WalletLinkChallengeRecord {
    const challenge: WalletLinkChallengeRecord = {
      id: createId("wch"),
      userId: params.userId,
      chainType: params.chainType,
      walletAddress: params.walletAddress,
      nonce: params.nonce,
      message: params.message,
      createdAt: nowIso(),
      expiresAt: params.expiresAt,
      usedAt: null,
    };

    this.store.walletChallenges.push(challenge);
    return challenge;
  }

  findChallengeById(challengeId: string): WalletLinkChallengeRecord | undefined {
    return this.store.walletChallenges.find((candidate) => candidate.id === challengeId);
  }

  markChallengeUsed(challengeId: string): WalletLinkChallengeRecord | undefined {
    const challenge = this.findChallengeById(challengeId);
    if (!challenge) {
      return undefined;
    }

    challenge.usedAt = nowIso();
    return challenge;
  }

  cleanupExpiredChallenges(nowIsoTimestamp: string): number {
    const nowMs = new Date(nowIsoTimestamp).getTime();
    const beforeCount = this.store.walletChallenges.length;

    this.store.walletChallenges = this.store.walletChallenges.filter((challenge) => {
      if (challenge.usedAt) {
        return false;
      }

      const expiresAtMs = new Date(challenge.expiresAt).getTime();
      return Number.isFinite(expiresAtMs) && expiresAtMs > nowMs;
    });

    return beforeCount - this.store.walletChallenges.length;
  }
}
