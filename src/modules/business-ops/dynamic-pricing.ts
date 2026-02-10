import type {
  BusinessOpsBusinessRecord,
  InventoryItemRecord,
  OfferRecord,
  PricingRuleRecord,
} from "./business-ops.types.js";

export type DynamicPricingSource =
  | "MANUAL_OVERRIDE"
  | "OFFER"
  | "PRICING_RULE"
  | "EXPIRY_CLEARANCE"
  | "STOCK_THRESHOLD"
  | "BASE";

export type DynamicPricingBlockedReason =
  | "BUSINESS_INACTIVE"
  | "INVENTORY_DISABLED"
  | "EXPIRED"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_STOCK";

export interface DynamicPricingAdjustment {
  source: DynamicPricingSource;
  sourceId: string | null;
  label: string;
  unitPriceCents: number;
  selected: boolean;
}

export interface DynamicPricingQuote {
  businessId: string;
  inventoryItemId: string;
  asOf: string;
  quantity: number;
  availableUnits: number;
  purchasable: boolean;
  blockedReason: DynamicPricingBlockedReason | null;
  expiresAt: string | null;
  baseUnitPriceCents: number;
  finalUnitPriceCents: number | null;
  finalTotalCents: number | null;
  selectedSource: DynamicPricingSource | null;
  selectedSourceId: string | null;
  adjustments: DynamicPricingAdjustment[];
}

export interface DynamicPricingQuoteInput {
  business: BusinessOpsBusinessRecord;
  inventoryItem: InventoryItemRecord;
  pricingRules: PricingRuleRecord[];
  offers: OfferRecord[];
  quantity: number;
  asOfIso: string;
  manualOverrideCents: number | null;
}

interface PriceCandidate {
  source: DynamicPricingSource;
  sourceId: string | null;
  label: string;
  unitPriceCents: number;
  precedence: number;
  stableOrder: string;
}

const STOCK_THRESHOLD_DISCOUNT_PERCENT = 10;

const EXPIRY_CLEARANCE_TIERS = [
  { maxHoursToExpiry: 12, percentOff: 35, label: "Expiry clearance <=12h" },
  { maxHoursToExpiry: 24, percentOff: 25, label: "Expiry clearance <=24h" },
  { maxHoursToExpiry: 48, percentOff: 15, label: "Expiry clearance <=48h" },
] as const;

const SOURCE_PRECEDENCE: Record<DynamicPricingSource, number> = {
  MANUAL_OVERRIDE: 0,
  OFFER: 1,
  PRICING_RULE: 2,
  EXPIRY_CLEARANCE: 3,
  STOCK_THRESHOLD: 4,
  BASE: 5,
};

function normalizeCents(value: number): number {
  return Math.max(0, Math.trunc(value));
}

function parseIsoDateToMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function isWithinWindow(nowMs: number, startsAt: string | null, endsAt: string | null): boolean {
  const startsAtMs = parseIsoDateToMs(startsAt);
  if (startsAtMs !== null && nowMs < startsAtMs) {
    return false;
  }

  const endsAtMs = parseIsoDateToMs(endsAt);
  if (endsAtMs !== null && nowMs > endsAtMs) {
    return false;
  }

  return true;
}

function applyPercentOff(basePriceCents: number, percentOff: number): number {
  const boundedPercent = Math.max(0, Math.min(100, percentOff));
  return normalizeCents(Math.floor((basePriceCents * (100 - boundedPercent)) / 100));
}

function compareCandidates(a: PriceCandidate, b: PriceCandidate): number {
  if (a.unitPriceCents !== b.unitPriceCents) {
    return a.unitPriceCents - b.unitPriceCents;
  }

  if (a.precedence !== b.precedence) {
    return a.precedence - b.precedence;
  }

  return a.stableOrder.localeCompare(b.stableOrder);
}

function sortOffersDeterministically(a: OfferRecord, b: OfferRecord): number {
  const aStart = parseIsoDateToMs(a.startsAt) ?? Number.MIN_SAFE_INTEGER;
  const bStart = parseIsoDateToMs(b.startsAt) ?? Number.MIN_SAFE_INTEGER;
  if (aStart !== bStart) {
    return aStart - bStart;
  }

  const aCreated = parseIsoDateToMs(a.createdAt) ?? Number.MIN_SAFE_INTEGER;
  const bCreated = parseIsoDateToMs(b.createdAt) ?? Number.MIN_SAFE_INTEGER;
  if (aCreated !== bCreated) {
    return aCreated - bCreated;
  }

  return a.id.localeCompare(b.id);
}

function sortRulesDeterministically(a: PricingRuleRecord, b: PricingRuleRecord): number {
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }

  const aCreated = parseIsoDateToMs(a.createdAt) ?? Number.MIN_SAFE_INTEGER;
  const bCreated = parseIsoDateToMs(b.createdAt) ?? Number.MIN_SAFE_INTEGER;
  if (aCreated !== bCreated) {
    return aCreated - bCreated;
  }

  return a.id.localeCompare(b.id);
}

function candidateFromPricingRule(
  baseUnitPriceCents: number,
  quantity: number,
  rule: PricingRuleRecord,
): PriceCandidate | null {
  let unitPriceCents: number | null = null;

  if (rule.ruleType === "PERCENT_OFF") {
    if (rule.percentOff !== null) {
      unitPriceCents = applyPercentOff(baseUnitPriceCents, rule.percentOff);
    }
  } else if (rule.ruleType === "AMOUNT_OFF") {
    if (rule.amountOffCents !== null) {
      unitPriceCents = normalizeCents(baseUnitPriceCents - rule.amountOffCents);
    }
  } else if (rule.ruleType === "FIXED_PRICE") {
    if (rule.fixedPriceCents !== null) {
      unitPriceCents = normalizeCents(rule.fixedPriceCents);
    }
  } else if (rule.ruleType === "BOGO") {
    if (quantity >= 2) {
      const payableUnits = Math.ceil(quantity / 2);
      const totalCents = payableUnits * baseUnitPriceCents;
      unitPriceCents = normalizeCents(Math.floor(totalCents / quantity));
    }
  } else if (rule.ruleType === "CLEARANCE") {
    if (rule.fixedPriceCents !== null) {
      unitPriceCents = normalizeCents(rule.fixedPriceCents);
    } else if (rule.percentOff !== null) {
      unitPriceCents = applyPercentOff(baseUnitPriceCents, rule.percentOff);
    } else if (rule.amountOffCents !== null) {
      unitPriceCents = normalizeCents(baseUnitPriceCents - rule.amountOffCents);
    } else {
      unitPriceCents = applyPercentOff(baseUnitPriceCents, 20);
    }
  }

  if (unitPriceCents === null) {
    return null;
  }

  return {
    source: "PRICING_RULE",
    sourceId: rule.id,
    label: `Rule: ${rule.name}`,
    unitPriceCents,
    precedence: SOURCE_PRECEDENCE.PRICING_RULE,
    stableOrder: `${String(rule.priority).padStart(8, "0")}:${rule.id}`,
  };
}

function buildBlockedQuote(input: {
  businessId: string;
  inventoryItemId: string;
  asOf: string;
  quantity: number;
  availableUnits: number;
  expiresAt: string | null;
  baseUnitPriceCents: number;
  blockedReason: DynamicPricingBlockedReason;
}): DynamicPricingQuote {
  return {
    businessId: input.businessId,
    inventoryItemId: input.inventoryItemId,
    asOf: input.asOf,
    quantity: input.quantity,
    availableUnits: input.availableUnits,
    purchasable: false,
    blockedReason: input.blockedReason,
    expiresAt: input.expiresAt,
    baseUnitPriceCents: input.baseUnitPriceCents,
    finalUnitPriceCents: null,
    finalTotalCents: null,
    selectedSource: null,
    selectedSourceId: null,
    adjustments: [
      {
        source: "BASE",
        sourceId: null,
        label: "Base price",
        unitPriceCents: input.baseUnitPriceCents,
        selected: false,
      },
    ],
  };
}

export function quoteDeterministicDynamicPrice(
  input: DynamicPricingQuoteInput,
): DynamicPricingQuote {
  const nowMs = parseIsoDateToMs(input.asOfIso);
  if (nowMs === null) {
    throw new Error(`Invalid asOfIso: ${input.asOfIso}`);
  }

  const baseUnitPriceCents = normalizeCents(input.inventoryItem.priceCents);
  const quantity = Math.max(1, Math.trunc(input.quantity));
  const availableUnits = Math.max(
    0,
    input.inventoryItem.quantityOnHand - input.inventoryItem.reservedQuantity,
  );
  const expiresAtMs = parseIsoDateToMs(input.inventoryItem.expiresAt);

  if (input.business.status !== "ACTIVE") {
    return buildBlockedQuote({
      businessId: input.business.id,
      inventoryItemId: input.inventoryItem.id,
      asOf: input.asOfIso,
      quantity,
      availableUnits,
      expiresAt: input.inventoryItem.expiresAt,
      baseUnitPriceCents,
      blockedReason: "BUSINESS_INACTIVE",
    });
  }

  if (!input.inventoryItem.isActive) {
    return buildBlockedQuote({
      businessId: input.business.id,
      inventoryItemId: input.inventoryItem.id,
      asOf: input.asOfIso,
      quantity,
      availableUnits,
      expiresAt: input.inventoryItem.expiresAt,
      baseUnitPriceCents,
      blockedReason: "INVENTORY_DISABLED",
    });
  }

  if (expiresAtMs !== null && nowMs >= expiresAtMs) {
    return buildBlockedQuote({
      businessId: input.business.id,
      inventoryItemId: input.inventoryItem.id,
      asOf: input.asOfIso,
      quantity,
      availableUnits,
      expiresAt: input.inventoryItem.expiresAt,
      baseUnitPriceCents,
      blockedReason: "EXPIRED",
    });
  }

  if (availableUnits <= 0) {
    return buildBlockedQuote({
      businessId: input.business.id,
      inventoryItemId: input.inventoryItem.id,
      asOf: input.asOfIso,
      quantity,
      availableUnits,
      expiresAt: input.inventoryItem.expiresAt,
      baseUnitPriceCents,
      blockedReason: "OUT_OF_STOCK",
    });
  }

  if (quantity > availableUnits) {
    return buildBlockedQuote({
      businessId: input.business.id,
      inventoryItemId: input.inventoryItem.id,
      asOf: input.asOfIso,
      quantity,
      availableUnits,
      expiresAt: input.inventoryItem.expiresAt,
      baseUnitPriceCents,
      blockedReason: "INSUFFICIENT_STOCK",
    });
  }

  const candidates: PriceCandidate[] = [
    {
      source: "BASE",
      sourceId: null,
      label: "Base price",
      unitPriceCents: baseUnitPriceCents,
      precedence: SOURCE_PRECEDENCE.BASE,
      stableOrder: "base",
    },
  ];

  const offerCandidates = input.offers
    .filter((offer) => {
      if (offer.status !== "LIVE") return false;
      if (offer.discountPriceCents === null) return false;
      if (!isWithinWindow(nowMs, offer.startsAt, offer.endsAt)) return false;
      if (offer.unitsTotal !== null && offer.unitsClaimed >= offer.unitsTotal) return false;
      return true;
    })
    .sort(sortOffersDeterministically);

  for (const offer of offerCandidates) {
    candidates.push({
      source: "OFFER",
      sourceId: offer.id,
      label: `Offer: ${offer.title}`,
      unitPriceCents: normalizeCents(offer.discountPriceCents ?? baseUnitPriceCents),
      precedence: SOURCE_PRECEDENCE.OFFER,
      stableOrder: offer.id,
    });
  }

  const pricingRuleCandidates = input.pricingRules
    .filter((rule) => {
      if (!rule.isActive) return false;
      if (!isWithinWindow(nowMs, rule.startsAt, rule.endsAt)) return false;
      if (rule.minQuantity !== null && quantity < rule.minQuantity) return false;
      if (rule.maxRedemptions !== null && rule.redemptionsUsed >= rule.maxRedemptions) {
        return false;
      }

      return true;
    })
    .sort(sortRulesDeterministically);

  for (const rule of pricingRuleCandidates) {
    const candidate = candidateFromPricingRule(baseUnitPriceCents, quantity, rule);
    if (!candidate) {
      continue;
    }
    candidates.push(candidate);
  }

  if (
    input.inventoryItem.lowStockThreshold !== null &&
    availableUnits <= input.inventoryItem.lowStockThreshold
  ) {
    candidates.push({
      source: "STOCK_THRESHOLD",
      sourceId: null,
      label: `Stock threshold <= ${input.inventoryItem.lowStockThreshold}`,
      unitPriceCents: applyPercentOff(
        baseUnitPriceCents,
        STOCK_THRESHOLD_DISCOUNT_PERCENT,
      ),
      precedence: SOURCE_PRECEDENCE.STOCK_THRESHOLD,
      stableOrder: `stock:${String(input.inventoryItem.lowStockThreshold).padStart(8, "0")}`,
    });
  }

  if (expiresAtMs !== null) {
    const hoursToExpiry = (expiresAtMs - nowMs) / (1000 * 60 * 60);
    const tier = EXPIRY_CLEARANCE_TIERS.find(
      (entry) => hoursToExpiry > 0 && hoursToExpiry <= entry.maxHoursToExpiry,
    );

    if (tier) {
      candidates.push({
        source: "EXPIRY_CLEARANCE",
        sourceId: null,
        label: tier.label,
        unitPriceCents: applyPercentOff(baseUnitPriceCents, tier.percentOff),
        precedence: SOURCE_PRECEDENCE.EXPIRY_CLEARANCE,
        stableOrder: `expiry:${String(tier.maxHoursToExpiry).padStart(8, "0")}`,
      });
    }
  }

  const manualOverrideCandidate =
    input.manualOverrideCents !== null
      ? {
          source: "MANUAL_OVERRIDE" as const,
          sourceId: null,
          label: "Manual override",
          unitPriceCents: normalizeCents(input.manualOverrideCents),
          precedence: SOURCE_PRECEDENCE.MANUAL_OVERRIDE,
          stableOrder: "manual",
        }
      : null;

  if (manualOverrideCandidate) {
    candidates.push(manualOverrideCandidate);
  }

  const selectedCandidate = manualOverrideCandidate
    ? manualOverrideCandidate
    : [...candidates].sort(compareCandidates)[0];

  if (!selectedCandidate) {
    return buildBlockedQuote({
      businessId: input.business.id,
      inventoryItemId: input.inventoryItem.id,
      asOf: input.asOfIso,
      quantity,
      availableUnits,
      expiresAt: input.inventoryItem.expiresAt,
      baseUnitPriceCents,
      blockedReason: "OUT_OF_STOCK",
    });
  }

  return {
    businessId: input.business.id,
    inventoryItemId: input.inventoryItem.id,
    asOf: input.asOfIso,
    quantity,
    availableUnits,
    purchasable: true,
    blockedReason: null,
    expiresAt: input.inventoryItem.expiresAt,
    baseUnitPriceCents,
    finalUnitPriceCents: selectedCandidate.unitPriceCents,
    finalTotalCents: normalizeCents(selectedCandidate.unitPriceCents * quantity),
    selectedSource: selectedCandidate.source,
    selectedSourceId: selectedCandidate.sourceId,
    adjustments: candidates
      .slice()
      .sort(compareCandidates)
      .map((candidate) => ({
        source: candidate.source,
        sourceId: candidate.sourceId,
        label: candidate.label,
        unitPriceCents: candidate.unitPriceCents,
        selected:
          candidate.source === selectedCandidate.source &&
          candidate.sourceId === selectedCandidate.sourceId &&
          candidate.unitPriceCents === selectedCandidate.unitPriceCents &&
          candidate.label === selectedCandidate.label,
      })),
  };
}

