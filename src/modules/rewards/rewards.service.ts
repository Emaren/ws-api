import { createId } from "../../shared/ids.js";
import { HttpError } from "../../shared/http-error.js";
import type {
  RewardLedgerEntryRecord,
  RewardPayoutStatus,
  RewardRuleId,
  RewardToken,
  UserRole,
} from "../../shared/models.js";
import { hasAnyRole, RBAC_ROLES } from "../../shared/rbac.js";
import type { RewardEntryFilters, RewardsRepository } from "./rewards.repository.js";

interface RewardRuleConfig {
  id: RewardRuleId;
  token: RewardToken;
  amountPerEvent: number;
  reason: string;
  requireSourceId: boolean;
  uniquePerSource: boolean;
  cooldownSeconds: number;
  dailyCap: number;
  maxQuantityPerRequest: number;
}

interface AccrualInput {
  requestingUserId: string;
  requestingRole: UserRole;
  ruleId: string;
  quantity?: number | undefined;
  sourceType?: string | undefined;
  sourceId?: string | undefined;
  idempotencyKey?: string | undefined;
  metadata?: unknown | undefined;
  targetUserId?: string | undefined;
}

interface ManualGrantInput {
  requestingRole: UserRole;
  userId: string;
  token: string;
  amount: number;
  reason: string;
  metadata?: unknown | undefined;
}

interface ListLedgerInput {
  requestingUserId: string;
  requestingRole: UserRole;
  userId?: string | undefined;
  token?: string | undefined;
  ruleId?: string | undefined;
  payoutStatus?: string | undefined;
  createdAfter?: string | undefined;
  createdBefore?: string | undefined;
}

interface ReportInput {
  requestingRole: UserRole;
  userId?: string | undefined;
  token?: string | undefined;
  ruleId?: string | undefined;
  payoutStatus?: string | undefined;
  createdAfter?: string | undefined;
  createdBefore?: string | undefined;
}

interface ExportPreviewInput {
  requestingRole: UserRole;
  format?: string | undefined;
  userId?: string | undefined;
  token?: string | undefined;
  ruleId?: string | undefined;
  payoutStatus?: string | undefined;
  createdAfter?: string | undefined;
  createdBefore?: string | undefined;
}

interface MarkExportInput {
  requestingRole: UserRole;
  entryIds?: string[] | undefined;
  payoutBatchId?: string | undefined;
  token?: string | undefined;
  ruleId?: string | undefined;
  payoutStatus?: string | undefined;
  createdAfter?: string | undefined;
  createdBefore?: string | undefined;
}

interface SettleExportInput {
  requestingRole: UserRole;
  payoutBatchId: string;
  payoutTxHash: string;
  entryIds?: string[] | undefined;
}

interface RewardRuleView {
  id: RewardRuleId;
  token: RewardToken;
  amountPerEvent: number;
  reason: string;
  antiAbuse: {
    requireSourceId: boolean;
    uniquePerSource: boolean;
    cooldownSeconds: number;
    dailyCap: number;
    maxQuantityPerRequest: number;
  };
}

const VALID_TOKENS: RewardToken[] = ["WHEAT", "STONE"];
const VALID_PAYOUT_STATUSES: RewardPayoutStatus[] = [
  "PENDING",
  "EXPORTED",
  "PAID",
  "VOID",
];

const REWARD_RULES: Record<RewardRuleId, RewardRuleConfig> = {
  ARTICLE_VIEW_STONE: {
    id: "ARTICLE_VIEW_STONE",
    token: "STONE",
    amountPerEvent: 1,
    reason: "Article view reward",
    requireSourceId: true,
    uniquePerSource: true,
    cooldownSeconds: 15,
    dailyCap: 120,
    maxQuantityPerRequest: 1,
  },
  ARTICLE_REACTION_STONE: {
    id: "ARTICLE_REACTION_STONE",
    token: "STONE",
    amountPerEvent: 2,
    reason: "Article reaction reward",
    requireSourceId: true,
    uniquePerSource: false,
    cooldownSeconds: 20,
    dailyCap: 200,
    maxQuantityPerRequest: 1,
  },
  ARTICLE_PUBLISH_WHEAT: {
    id: "ARTICLE_PUBLISH_WHEAT",
    token: "WHEAT",
    amountPerEvent: 50,
    reason: "Published article contributor reward",
    requireSourceId: true,
    uniquePerSource: true,
    cooldownSeconds: 0,
    dailyCap: 250,
    maxQuantityPerRequest: 1,
  },
  DELIVERY_LEAD_WHEAT: {
    id: "DELIVERY_LEAD_WHEAT",
    token: "WHEAT",
    amountPerEvent: 10,
    reason: "Delivery lead reward",
    requireSourceId: true,
    uniquePerSource: true,
    cooldownSeconds: 0,
    dailyCap: 500,
    maxQuantityPerRequest: 5,
  },
  NOTIFICATION_OPT_IN_STONE: {
    id: "NOTIFICATION_OPT_IN_STONE",
    token: "STONE",
    amountPerEvent: 5,
    reason: "Notification opt-in reward",
    requireSourceId: true,
    uniquePerSource: true,
    cooldownSeconds: 0,
    dailyCap: 25,
    maxQuantityPerRequest: 1,
  },
  MANUAL_GRANT: {
    id: "MANUAL_GRANT",
    token: "WHEAT",
    amountPerEvent: 0,
    reason: "Manual grant",
    requireSourceId: false,
    uniquePerSource: false,
    cooldownSeconds: 0,
    dailyCap: Number.MAX_SAFE_INTEGER,
    maxQuantityPerRequest: 1,
  },
};

function normalizeToken(input: string | undefined): RewardToken | undefined {
  if (!input) return undefined;
  const token = input.trim().toUpperCase();
  if (!token) return undefined;
  if (!VALID_TOKENS.includes(token as RewardToken)) {
    throw new HttpError(400, "Invalid reward token");
  }

  return token as RewardToken;
}

function normalizeRuleId(input: string | undefined): RewardRuleId | undefined {
  if (!input) return undefined;
  const ruleId = input.trim().toUpperCase() as RewardRuleId;
  if (!ruleId) return undefined;
  if (!Object.prototype.hasOwnProperty.call(REWARD_RULES, ruleId)) {
    throw new HttpError(400, "Invalid reward ruleId");
  }

  return ruleId;
}

function normalizePayoutStatus(input: string | undefined): RewardPayoutStatus | undefined {
  if (!input) return undefined;
  const normalized = input.trim().toUpperCase() as RewardPayoutStatus;
  if (!normalized) return undefined;
  if (!VALID_PAYOUT_STATUSES.includes(normalized)) {
    throw new HttpError(400, "Invalid payoutStatus");
  }

  return normalized;
}

function normalizeOptionalString(input: string | undefined, maxLength: number): string | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeIsoDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "Invalid ISO date filter");
  }

  return parsed.toISOString();
}

function ensureOwnerAdmin(role: UserRole): void {
  if (!hasAnyRole(role, RBAC_ROLES.ownerAdmin)) {
    throw new HttpError(403, "Owner/Admin role required");
  }
}

function parseMetadata(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const asRecord = input as Record<string, unknown>;
  const keys = Object.keys(asRecord).slice(0, 32);
  const compact: Record<string, unknown> = {};

  for (const key of keys) {
    if (typeof key !== "string" || key.trim().length === 0) continue;
    compact[key.slice(0, 64)] = asRecord[key];
  }

  return Object.keys(compact).length > 0 ? compact : null;
}

function toRuleView(rule: RewardRuleConfig): RewardRuleView {
  return {
    id: rule.id,
    token: rule.token,
    amountPerEvent: rule.amountPerEvent,
    reason: rule.reason,
    antiAbuse: {
      requireSourceId: rule.requireSourceId,
      uniquePerSource: rule.uniquePerSource,
      cooldownSeconds: rule.cooldownSeconds,
      dailyCap: rule.dailyCap,
      maxQuantityPerRequest: rule.maxQuantityPerRequest,
    },
  };
}

function utcDayWindow(now: Date): { startIso: string; endIso: string } {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function toFiniteAmount(value: number): number {
  if (!Number.isFinite(value) || value === 0) {
    throw new HttpError(400, "amount must be a non-zero number");
  }

  return Number(value.toFixed(8));
}

function safeRule(ruleId: RewardRuleId): RewardRuleConfig {
  const rule = REWARD_RULES[ruleId];
  if (!rule) {
    throw new HttpError(400, "Invalid reward ruleId");
  }

  return rule;
}

function normalizeEntryFilters(input: {
  userId?: string | undefined;
  token?: string | undefined;
  ruleId?: string | undefined;
  payoutStatus?: string | undefined;
  createdAfter?: string | undefined;
  createdBefore?: string | undefined;
}): RewardEntryFilters {
  return {
    userId: normalizeOptionalString(input.userId, 96) ?? undefined,
    token: normalizeToken(input.token),
    ruleId: normalizeRuleId(input.ruleId),
    payoutStatus: normalizePayoutStatus(input.payoutStatus),
    createdAfter: normalizeIsoDate(input.createdAfter),
    createdBefore: normalizeIsoDate(input.createdBefore),
  };
}

function toCsv(entries: RewardLedgerEntryRecord[]): string {
  const header = [
    "id",
    "userId",
    "token",
    "amount",
    "ruleId",
    "reason",
    "sourceType",
    "sourceId",
    "payoutStatus",
    "payoutBatchId",
    "payoutTxHash",
    "createdAt",
    "exportedAt",
    "settledAt",
  ];

  const lines = [header.join(",")];

  for (const entry of entries) {
    const values = [
      entry.id,
      entry.userId,
      entry.token,
      entry.amount.toString(),
      entry.ruleId,
      entry.reason,
      entry.sourceType ?? "",
      entry.sourceId ?? "",
      entry.payoutStatus,
      entry.payoutBatchId ?? "",
      entry.payoutTxHash ?? "",
      entry.createdAt,
      entry.exportedAt ?? "",
      entry.settledAt ?? "",
    ];

    lines.push(
      values
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );
  }

  return lines.join("\n");
}

function compactTokenTotals(entries: RewardLedgerEntryRecord[]): Record<RewardToken, number> {
  return entries.reduce(
    (acc, entry) => {
      acc[entry.token] += entry.amount;
      return acc;
    },
    { WHEAT: 0, STONE: 0 } as Record<RewardToken, number>,
  );
}

export class RewardsService {
  constructor(private readonly rewardsRepository: RewardsRepository) {}

  listRules(): RewardRuleView[] {
    return Object.values(REWARD_RULES)
      .filter((rule) => rule.id !== "MANUAL_GRANT")
      .map(toRuleView);
  }

  listEntries(input: ListLedgerInput): RewardLedgerEntryRecord[] {
    const filters = normalizeEntryFilters({
      userId: input.userId,
      token: input.token,
      ruleId: input.ruleId,
      payoutStatus: input.payoutStatus,
      createdAfter: input.createdAfter,
      createdBefore: input.createdBefore,
    });

    if (hasAnyRole(input.requestingRole, RBAC_ROLES.ownerAdmin)) {
      return this.rewardsRepository.listEntries(filters);
    }

    const requestedUserId = filters.userId;
    if (requestedUserId && requestedUserId !== input.requestingUserId) {
      throw new HttpError(403, "Cannot access another user's reward ledger");
    }

    return this.rewardsRepository.listEntries({
      ...filters,
      userId: input.requestingUserId,
    });
  }

  addManualEntry(input: ManualGrantInput): RewardLedgerEntryRecord {
    ensureOwnerAdmin(input.requestingRole);

    const userId = normalizeOptionalString(input.userId, 96);
    const reason = normalizeOptionalString(input.reason, 240);
    const token = normalizeToken(input.token);

    if (!userId || !reason || !token) {
      throw new HttpError(400, "Missing userId, token, or reason");
    }

    const amount = toFiniteAmount(input.amount);

    return this.rewardsRepository.createEntry({
      userId,
      token,
      amount,
      reason,
      ruleId: "MANUAL_GRANT",
      sourceType: "manual",
      sourceId: null,
      idempotencyKey: null,
      metadata: parseMetadata(input.metadata),
      payoutStatus: amount > 0 ? "PENDING" : "VOID",
    });
  }

  accrueByRule(input: AccrualInput): RewardLedgerEntryRecord {
    const ruleId = normalizeRuleId(input.ruleId);
    if (!ruleId) {
      throw new HttpError(400, "ruleId is required");
    }

    if (ruleId === "MANUAL_GRANT") {
      throw new HttpError(400, "MANUAL_GRANT cannot be accrued through rules");
    }

    const rule = safeRule(ruleId);

    const targetUserId = normalizeOptionalString(input.targetUserId, 96);
    let userId = input.requestingUserId;
    if (targetUserId && targetUserId !== input.requestingUserId) {
      ensureOwnerAdmin(input.requestingRole);
      userId = targetUserId;
    }

    const quantityRaw = input.quantity ?? 1;
    const quantity = Number.isFinite(quantityRaw) ? Math.floor(quantityRaw) : 0;
    if (quantity <= 0 || quantity > rule.maxQuantityPerRequest) {
      throw new HttpError(
        400,
        `quantity must be between 1 and ${rule.maxQuantityPerRequest}`,
      );
    }

    const sourceId = normalizeOptionalString(input.sourceId, 160);
    if (rule.requireSourceId && !sourceId) {
      throw new HttpError(400, `rule ${rule.id} requires sourceId`);
    }

    const sourceType = normalizeOptionalString(input.sourceType, 64);
    const idempotencyKey = normalizeOptionalString(input.idempotencyKey, 160);

    if (idempotencyKey) {
      const duplicate = this.rewardsRepository.findByIdempotencyKey(userId, idempotencyKey);
      if (duplicate) {
        throw new HttpError(409, "Duplicate idempotencyKey for user");
      }
    }

    if (sourceId && rule.uniquePerSource) {
      const duplicateSource = this.rewardsRepository.findByUserRuleSource(
        userId,
        rule.id,
        sourceId,
      );
      if (duplicateSource) {
        throw new HttpError(409, "Reward already accrued for this rule/sourceId");
      }
    }

    if (rule.cooldownSeconds > 0) {
      const latest = this.rewardsRepository.findLatestByUserRule(userId, rule.id);
      if (latest) {
        const latestMs = new Date(latest.createdAt).getTime();
        const cooldownUntilMs = latestMs + rule.cooldownSeconds * 1000;
        if (Number.isFinite(latestMs) && cooldownUntilMs > Date.now()) {
          throw new HttpError(429, "Reward cooldown active; try again later");
        }
      }
    }

    const amount = toFiniteAmount(rule.amountPerEvent * quantity);
    const now = new Date();
    const window = utcDayWindow(now);
    const accruedToday = this.rewardsRepository.sumUserTokenInWindow(
      userId,
      rule.token,
      window.startIso,
      window.endIso,
    );

    if (accruedToday + amount > rule.dailyCap) {
      throw new HttpError(429, `Daily ${rule.token} cap reached for ${rule.id}`);
    }

    const metadataFromInput = parseMetadata(input.metadata);
    const metadata: Record<string, unknown> = {
      quantity,
      antiAbuse: {
        cooldownSeconds: rule.cooldownSeconds,
        dailyCap: rule.dailyCap,
        maxQuantityPerRequest: rule.maxQuantityPerRequest,
      },
      ...(metadataFromInput ?? {}),
    };

    return this.rewardsRepository.createEntry({
      userId,
      token: rule.token,
      amount,
      reason: rule.reason,
      ruleId: rule.id,
      sourceType,
      sourceId,
      idempotencyKey,
      metadata,
      payoutStatus: "PENDING",
    });
  }

  buildReport(input: ReportInput): {
    generatedAt: string;
    filters: RewardEntryFilters;
    summary: {
      entries: number;
      totalByToken: Record<RewardToken, number>;
      pendingByToken: Record<RewardToken, number>;
      exportedByToken: Record<RewardToken, number>;
      paidByToken: Record<RewardToken, number>;
    };
    byRule: Array<{ ruleId: RewardRuleId; token: RewardToken; entries: number; amount: number }>;
    byUser: Array<{ userId: string; entries: number; amountByToken: Record<RewardToken, number> }>;
  } {
    ensureOwnerAdmin(input.requestingRole);

    const filters = normalizeEntryFilters(input);
    const entries = this.rewardsRepository.listEntries(filters);

    const pending = entries.filter((entry) => entry.payoutStatus === "PENDING");
    const exported = entries.filter((entry) => entry.payoutStatus === "EXPORTED");
    const paid = entries.filter((entry) => entry.payoutStatus === "PAID");

    const byRuleMap = new Map<RewardRuleId, { token: RewardToken; entries: number; amount: number }>();
    const byUserMap = new Map<string, { entries: number; amountByToken: Record<RewardToken, number> }>();

    for (const entry of entries) {
      const ruleAggregate = byRuleMap.get(entry.ruleId) ?? {
        token: entry.token,
        entries: 0,
        amount: 0,
      };
      ruleAggregate.entries += 1;
      ruleAggregate.amount += entry.amount;
      byRuleMap.set(entry.ruleId, ruleAggregate);

      const userAggregate = byUserMap.get(entry.userId) ?? {
        entries: 0,
        amountByToken: { WHEAT: 0, STONE: 0 },
      };
      userAggregate.entries += 1;
      userAggregate.amountByToken[entry.token] += entry.amount;
      byUserMap.set(entry.userId, userAggregate);
    }

    return {
      generatedAt: new Date().toISOString(),
      filters,
      summary: {
        entries: entries.length,
        totalByToken: compactTokenTotals(entries),
        pendingByToken: compactTokenTotals(pending),
        exportedByToken: compactTokenTotals(exported),
        paidByToken: compactTokenTotals(paid),
      },
      byRule: [...byRuleMap.entries()]
        .map(([ruleId, aggregate]) => ({
          ruleId,
          token: aggregate.token,
          entries: aggregate.entries,
          amount: aggregate.amount,
        }))
        .sort((a, b) => b.amount - a.amount),
      byUser: [...byUserMap.entries()]
        .map(([userId, aggregate]) => ({
          userId,
          entries: aggregate.entries,
          amountByToken: aggregate.amountByToken,
        }))
        .sort((a, b) => b.entries - a.entries),
    };
  }

  exportPreview(input: ExportPreviewInput):
    | {
        format: "json";
        payoutBatchId: string;
        generatedAt: string;
        count: number;
        entries: RewardLedgerEntryRecord[];
      }
    | {
        format: "csv";
        payoutBatchId: string;
        generatedAt: string;
        count: number;
        csv: string;
      } {
    ensureOwnerAdmin(input.requestingRole);

    const format = (input.format ?? "json").trim().toLowerCase();
    if (format !== "json" && format !== "csv") {
      throw new HttpError(400, "format must be json or csv");
    }

    const filters = normalizeEntryFilters({
      userId: input.userId,
      token: input.token,
      ruleId: input.ruleId,
      payoutStatus: input.payoutStatus ?? "PENDING",
      createdAfter: input.createdAfter,
      createdBefore: input.createdBefore,
    });

    const entries = this.rewardsRepository.listEntries(filters);
    const payoutBatchId = createId("payout_batch");
    const generatedAt = new Date().toISOString();

    if (format === "csv") {
      return {
        format,
        payoutBatchId,
        generatedAt,
        count: entries.length,
        csv: toCsv(entries),
      };
    }

    return {
      format,
      payoutBatchId,
      generatedAt,
      count: entries.length,
      entries,
    };
  }

  markExported(input: MarkExportInput): {
    payoutBatchId: string;
    requested: number;
    exported: number;
    ids: string[];
  } {
    ensureOwnerAdmin(input.requestingRole);

    const payoutBatchId =
      normalizeOptionalString(input.payoutBatchId, 128) ?? createId("payout_batch");

    const entryIdsFromBody = (input.entryIds ?? [])
      .map((entryId) => normalizeOptionalString(entryId, 96))
      .filter((entryId): entryId is string => Boolean(entryId));

    const selectedIds =
      entryIdsFromBody.length > 0
        ? entryIdsFromBody
        : this.rewardsRepository
            .listEntries(
              normalizeEntryFilters({
                token: input.token,
                ruleId: input.ruleId,
                payoutStatus: input.payoutStatus ?? "PENDING",
                createdAfter: input.createdAfter,
                createdBefore: input.createdBefore,
              }),
            )
            .map((entry) => entry.id);

    const exportedEntries = this.rewardsRepository.markEntriesExported(
      selectedIds,
      payoutBatchId,
    );

    return {
      payoutBatchId,
      requested: selectedIds.length,
      exported: exportedEntries.length,
      ids: exportedEntries.map((entry) => entry.id),
    };
  }

  settleExportBatch(input: SettleExportInput): {
    payoutBatchId: string;
    payoutTxHash: string;
    requested: number;
    settled: number;
    ids: string[];
  } {
    ensureOwnerAdmin(input.requestingRole);

    const payoutBatchId = normalizeOptionalString(input.payoutBatchId, 128);
    const payoutTxHash = normalizeOptionalString(input.payoutTxHash, 256);

    if (!payoutBatchId || !payoutTxHash) {
      throw new HttpError(400, "payoutBatchId and payoutTxHash are required");
    }

    const selectedIds =
      (input.entryIds ?? [])
        .map((entryId) => normalizeOptionalString(entryId, 96))
        .filter((entryId): entryId is string => Boolean(entryId));

    const ids =
      selectedIds.length > 0
        ? selectedIds
        : this.rewardsRepository
            .listEntries({ payoutStatus: "EXPORTED" })
            .filter((entry) => entry.payoutBatchId === payoutBatchId)
            .map((entry) => entry.id);

    const settledEntries = this.rewardsRepository.markEntriesPaid(
      ids,
      payoutBatchId,
      payoutTxHash,
    );

    return {
      payoutBatchId,
      payoutTxHash,
      requested: ids.length,
      settled: settledEntries.length,
      ids: settledEntries.map((entry) => entry.id),
    };
  }
}
