import { HttpError } from "../../shared/http-error.js";
import { createId, nowIso } from "../../shared/ids.js";
import type { BusinessOpsRepository } from "./business-ops.repository.js";
import {
  AFFILIATE_NETWORKS,
  BUSINESS_STATUSES,
  CAMPAIGN_STATUSES,
  CAMPAIGN_TYPES,
  DELIVERY_LEAD_SOURCES,
  DELIVERY_LEAD_STATUSES,
  NOTIFICATION_CHANNELS,
  OFFER_STATUSES,
  PRICING_RULE_TYPES,
  REWARD_DIRECTIONS,
  REWARD_TOKENS,
  type AffiliateClickRecord,
  type BusinessOpsBusinessRecord,
  type BusinessStatus,
  type CampaignRecord,
  type CampaignStatus,
  type CampaignType,
  type DeliveryLeadRecord,
  type DeliveryLeadSource,
  type DeliveryLeadStatus,
  type InventoryItemRecord,
  type NotificationChannel,
  type NotificationRecipientRecord,
  type OfferRecord,
  type OfferStatus,
  type PricingRuleRecord,
  type PricingRuleType,
  type RewardDirection,
  type RewardLedgerRecord,
  type RewardToken,
  type StoreProfileRecord,
} from "./business-ops.types.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${label} must be a JSON object`);
  }

  return value as JsonRecord;
}

function hasKey(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function optionalTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredTrimmedString(value: unknown, field: string): string {
  const normalized = optionalTrimmedString(value);
  if (!normalized) {
    throw new HttpError(400, `${field} is required`);
  }

  return normalized;
}

function optionalBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function booleanOrDefault(value: unknown, fallback: boolean, field: string): boolean {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  throw new HttpError(400, `${field} must be a boolean`);
}

function integerOrDefault(
  value: unknown,
  fallback: number,
  field: string,
  min: number | null = null,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new HttpError(400, `${field} must be an integer`);
  }

  if (min !== null && value < min) {
    throw new HttpError(400, `${field} must be >= ${min}`);
  }

  return value;
}

function optionalInteger(value: unknown, field: string, min: number | null = null): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new HttpError(400, `${field} must be an integer`);
  }

  if (min !== null && value < min) {
    throw new HttpError(400, `${field} must be >= ${min}`);
  }

  return value;
}

function optionalNumber(
  value: unknown,
  field: string,
  min: number | null = null,
  max: number | null = null,
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpError(400, `${field} must be a number`);
  }

  if (min !== null && value < min) {
    throw new HttpError(400, `${field} must be >= ${min}`);
  }

  if (max !== null && value > max) {
    throw new HttpError(400, `${field} must be <= ${max}`);
  }

  return value;
}

function numberOrDefault(
  value: unknown,
  fallback: number,
  field: string,
  min: number | null = null,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new HttpError(400, `${field} must be a number`);
  }

  if (min !== null && value < min) {
    throw new HttpError(400, `${field} must be >= ${min}`);
  }

  return value;
}

function optionalIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be an ISO date string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `${field} must be an ISO date string`);
  }

  return new Date(parsed).toISOString();
}

function requiredIsoDate(value: unknown, field: string): string {
  const normalized = optionalIsoDate(value, field);
  if (!normalized) {
    throw new HttpError(400, `${field} is required`);
  }

  return normalized;
}

function optionalObject(value: unknown, field: string): Record<string, unknown> | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${field} must be an object`);
  }

  return value as Record<string, unknown>;
}

function enumOrDefault<T extends string>(
  value: unknown,
  fallback: T,
  field: string,
  allowed: readonly T[],
): T {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be one of ${allowed.join(", ")}`);
  }

  const upper = value.trim().toUpperCase() as T;
  if (!allowed.includes(upper)) {
    throw new HttpError(400, `${field} must be one of ${allowed.join(", ")}`);
  }

  return upper;
}

function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be one of ${allowed.join(", ")}`);
  }

  const upper = value.trim().toUpperCase() as T;
  if (!allowed.includes(upper)) {
    throw new HttpError(400, `${field} must be one of ${allowed.join(", ")}`);
  }

  return upper;
}

function toSlug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);

  if (!normalized) {
    throw new HttpError(400, "slug is required");
  }

  return normalized;
}

export class BusinessOpsService {
  constructor(private readonly repository: BusinessOpsRepository) {}

  private requireBusiness(id: string): BusinessOpsBusinessRecord {
    const business = this.repository.getById("businesses", id);
    if (!business) {
      throw new HttpError(404, "Business not found");
    }

    return business;
  }

  private requireStoreProfile(id: string): StoreProfileRecord {
    const profile = this.repository.getById("storeProfiles", id);
    if (!profile) {
      throw new HttpError(404, "StoreProfile not found");
    }

    return profile;
  }

  private requireInventoryItem(id: string): InventoryItemRecord {
    const item = this.repository.getById("inventoryItems", id);
    if (!item) {
      throw new HttpError(404, "InventoryItem not found");
    }

    return item;
  }

  private requirePricingRule(id: string): PricingRuleRecord {
    const rule = this.repository.getById("pricingRules", id);
    if (!rule) {
      throw new HttpError(404, "PricingRule not found");
    }

    return rule;
  }

  private requireOffer(id: string): OfferRecord {
    const offer = this.repository.getById("offers", id);
    if (!offer) {
      throw new HttpError(404, "Offer not found");
    }

    return offer;
  }

  private requireCampaign(id: string): CampaignRecord {
    const campaign = this.repository.getById("campaigns", id);
    if (!campaign) {
      throw new HttpError(404, "Campaign not found");
    }

    return campaign;
  }

  private requireNotificationRecipient(id: string): NotificationRecipientRecord {
    const recipient = this.repository.getById("notificationRecipients", id);
    if (!recipient) {
      throw new HttpError(404, "NotificationRecipient not found");
    }

    return recipient;
  }

  private requireDeliveryLead(id: string): DeliveryLeadRecord {
    const lead = this.repository.getById("deliveryLeads", id);
    if (!lead) {
      throw new HttpError(404, "DeliveryLead not found");
    }

    return lead;
  }

  private requireAffiliateClick(id: string): AffiliateClickRecord {
    const click = this.repository.getById("affiliateClicks", id);
    if (!click) {
      throw new HttpError(404, "AffiliateClick not found");
    }

    return click;
  }

  private requireRewardLedger(id: string): RewardLedgerRecord {
    const entry = this.repository.getById("rewardLedger", id);
    if (!entry) {
      throw new HttpError(404, "RewardLedger entry not found");
    }

    return entry;
  }

  private ensureUniqueBusinessSlug(slug: string, ignoreBusinessId?: string): void {
    const existing = this.repository.findFirst(
      "businesses",
      (business) => business.slug === slug && business.id !== ignoreBusinessId,
    );

    if (existing) {
      throw new HttpError(409, `Business slug already exists: ${slug}`);
    }
  }

  private ensureUniqueInventorySku(
    businessId: string,
    sku: string | null,
    ignoreId?: string,
  ): void {
    if (!sku) {
      return;
    }

    const existing = this.repository.findFirst(
      "inventoryItems",
      (item) => item.businessId === businessId && item.sku === sku && item.id !== ignoreId,
    );

    if (existing) {
      throw new HttpError(409, `InventoryItem sku already exists for business: ${sku}`);
    }
  }

  private ensureUniqueOfferCouponCode(
    businessId: string,
    couponCode: string | null,
    ignoreId?: string,
  ): void {
    if (!couponCode) {
      return;
    }

    const existing = this.repository.findFirst(
      "offers",
      (offer) =>
        offer.businessId === businessId &&
        offer.couponCode === couponCode &&
        offer.id !== ignoreId,
    );

    if (existing) {
      throw new HttpError(409, `Offer couponCode already exists for business: ${couponCode}`);
    }
  }

  private ensureUniqueNotificationRecipient(
    businessId: string,
    email: string | null,
    phone: string | null,
    ignoreId?: string,
  ): void {
    if (email) {
      const existingEmail = this.repository.findFirst(
        "notificationRecipients",
        (recipient) =>
          recipient.businessId === businessId && recipient.email === email && recipient.id !== ignoreId,
      );

      if (existingEmail) {
        throw new HttpError(409, `NotificationRecipient email already exists for business: ${email}`);
      }
    }

    if (phone) {
      const existingPhone = this.repository.findFirst(
        "notificationRecipients",
        (recipient) =>
          recipient.businessId === businessId && recipient.phone === phone && recipient.id !== ignoreId,
      );

      if (existingPhone) {
        throw new HttpError(409, `NotificationRecipient phone already exists for business: ${phone}`);
      }
    }
  }

  private ensureUniqueRewardExternalRef(externalRef: string | null, ignoreId?: string): void {
    if (!externalRef) {
      return;
    }

    const existing = this.repository.findFirst(
      "rewardLedger",
      (entry) => entry.externalRef === externalRef && entry.id !== ignoreId,
    );

    if (existing) {
      throw new HttpError(409, `RewardLedger externalRef already exists: ${externalRef}`);
    }
  }

  listBusinesses(): BusinessOpsBusinessRecord[] {
    return this.repository.list("businesses");
  }

  getBusiness(id: string): BusinessOpsBusinessRecord {
    return this.requireBusiness(id);
  }

  createBusiness(payload: unknown): BusinessOpsBusinessRecord {
    const input = asRecord(payload, "business");
    const now = nowIso();

    const slugInput = hasKey(input, "slug")
      ? requiredTrimmedString(input.slug, "slug")
      : requiredTrimmedString(input.name, "name");
    const slug = toSlug(slugInput);

    this.ensureUniqueBusinessSlug(slug);

    const record: BusinessOpsBusinessRecord = {
      id: createId("biz"),
      slug,
      name: requiredTrimmedString(input.name, "name"),
      legalName: optionalTrimmedString(input.legalName),
      ownerUserId: optionalTrimmedString(input.ownerUserId),
      contactEmail: optionalTrimmedString(input.contactEmail),
      contactPhone: optionalTrimmedString(input.contactPhone),
      timezone: optionalTrimmedString(input.timezone) ?? "America/Edmonton",
      status: enumOrDefault(input.status, "ACTIVE", "status", BUSINESS_STATUSES),
      isVerified: booleanOrDefault(input.isVerified, false, "isVerified"),
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create("businesses", record);
  }

  updateBusiness(id: string, payload: unknown): BusinessOpsBusinessRecord {
    const current = this.requireBusiness(id);
    const input = asRecord(payload, "business patch");
    const next: BusinessOpsBusinessRecord = { ...current };

    if (hasKey(input, "slug")) {
      const slug = toSlug(requiredTrimmedString(input.slug, "slug"));
      this.ensureUniqueBusinessSlug(slug, id);
      next.slug = slug;
    }

    if (hasKey(input, "name")) {
      next.name = requiredTrimmedString(input.name, "name");
    }

    if (hasKey(input, "legalName")) {
      next.legalName = optionalTrimmedString(input.legalName);
    }

    if (hasKey(input, "ownerUserId")) {
      next.ownerUserId = optionalTrimmedString(input.ownerUserId);
    }

    if (hasKey(input, "contactEmail")) {
      next.contactEmail = optionalTrimmedString(input.contactEmail);
    }

    if (hasKey(input, "contactPhone")) {
      next.contactPhone = optionalTrimmedString(input.contactPhone);
    }

    if (hasKey(input, "timezone")) {
      next.timezone = requiredTrimmedString(input.timezone, "timezone");
    }

    if (hasKey(input, "status")) {
      next.status = enumOrDefault(
        input.status,
        current.status,
        "status",
        BUSINESS_STATUSES,
      ) as BusinessStatus;
    }

    if (hasKey(input, "isVerified")) {
      const isVerified = optionalBoolean(input.isVerified);
      if (isVerified === null) {
        throw new HttpError(400, "isVerified must be a boolean");
      }
      next.isVerified = isVerified;
    }

    next.updatedAt = nowIso();

    return this.repository.update("businesses", id, () => next) ?? next;
  }

  deleteBusiness(id: string): BusinessOpsBusinessRecord {
    const deleted = this.repository.delete("businesses", id);
    if (!deleted) {
      throw new HttpError(404, "Business not found");
    }

    for (const profile of this.repository.list("storeProfiles")) {
      if (profile.businessId === id) {
        this.repository.delete("storeProfiles", profile.id);
      }
    }

    for (const item of this.repository.list("inventoryItems")) {
      if (item.businessId === id) {
        this.repository.delete("inventoryItems", item.id);
      }
    }

    for (const rule of this.repository.list("pricingRules")) {
      if (rule.businessId === id) {
        this.repository.delete("pricingRules", rule.id);
      }
    }

    for (const offer of this.repository.list("offers")) {
      if (offer.businessId === id) {
        this.repository.delete("offers", offer.id);
      }
    }

    for (const campaign of this.repository.list("campaigns")) {
      if (campaign.businessId === id) {
        this.repository.delete("campaigns", campaign.id);
      }
    }

    for (const recipient of this.repository.list("notificationRecipients")) {
      if (recipient.businessId === id) {
        this.repository.delete("notificationRecipients", recipient.id);
      }
    }

    for (const lead of this.repository.list("deliveryLeads")) {
      if (lead.businessId === id) {
        this.repository.delete("deliveryLeads", lead.id);
      }
    }

    for (const click of this.repository.list("affiliateClicks")) {
      if (click.businessId === id) {
        this.repository.delete("affiliateClicks", click.id);
      }
    }

    for (const entry of this.repository.list("rewardLedger")) {
      if (entry.businessId === id) {
        this.repository.delete("rewardLedger", entry.id);
      }
    }

    return deleted;
  }

  listStoreProfiles(): StoreProfileRecord[] {
    return this.repository.list("storeProfiles");
  }

  getStoreProfile(id: string): StoreProfileRecord {
    return this.requireStoreProfile(id);
  }

  createStoreProfile(payload: unknown): StoreProfileRecord {
    const input = asRecord(payload, "storeProfile");
    const now = nowIso();
    const businessId = requiredTrimmedString(input.businessId, "businessId");

    this.requireBusiness(businessId);

    const existing = this.repository.findFirst(
      "storeProfiles",
      (profile) => profile.businessId === businessId,
    );
    if (existing) {
      throw new HttpError(409, "StoreProfile already exists for this business");
    }

    const record: StoreProfileRecord = {
      id: createId("profile"),
      businessId,
      displayName: optionalTrimmedString(input.displayName),
      description: optionalTrimmedString(input.description),
      logoUrl: optionalTrimmedString(input.logoUrl),
      heroImageUrl: optionalTrimmedString(input.heroImageUrl),
      websiteUrl: optionalTrimmedString(input.websiteUrl),
      addressLine1: optionalTrimmedString(input.addressLine1),
      addressLine2: optionalTrimmedString(input.addressLine2),
      city: optionalTrimmedString(input.city),
      region: optionalTrimmedString(input.region),
      postalCode: optionalTrimmedString(input.postalCode),
      country: optionalTrimmedString(input.country),
      latitude: optionalNumber(input.latitude, "latitude", -90, 90),
      longitude: optionalNumber(input.longitude, "longitude", -180, 180),
      deliveryRadiusKm: optionalInteger(input.deliveryRadiusKm, "deliveryRadiusKm", 0),
      pickupEnabled: booleanOrDefault(input.pickupEnabled, true, "pickupEnabled"),
      deliveryEnabled: booleanOrDefault(input.deliveryEnabled, false, "deliveryEnabled"),
      notificationEmail: optionalTrimmedString(input.notificationEmail),
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create("storeProfiles", record);
  }

  updateStoreProfile(id: string, payload: unknown): StoreProfileRecord {
    const current = this.requireStoreProfile(id);
    const input = asRecord(payload, "storeProfile patch");
    const next: StoreProfileRecord = { ...current };

    if (hasKey(input, "businessId")) {
      const businessId = requiredTrimmedString(input.businessId, "businessId");
      this.requireBusiness(businessId);

      const existing = this.repository.findFirst(
        "storeProfiles",
        (profile) => profile.businessId === businessId && profile.id !== id,
      );
      if (existing) {
        throw new HttpError(409, "StoreProfile already exists for this business");
      }

      next.businessId = businessId;
    }

    if (hasKey(input, "displayName")) next.displayName = optionalTrimmedString(input.displayName);
    if (hasKey(input, "description")) next.description = optionalTrimmedString(input.description);
    if (hasKey(input, "logoUrl")) next.logoUrl = optionalTrimmedString(input.logoUrl);
    if (hasKey(input, "heroImageUrl")) next.heroImageUrl = optionalTrimmedString(input.heroImageUrl);
    if (hasKey(input, "websiteUrl")) next.websiteUrl = optionalTrimmedString(input.websiteUrl);
    if (hasKey(input, "addressLine1")) next.addressLine1 = optionalTrimmedString(input.addressLine1);
    if (hasKey(input, "addressLine2")) next.addressLine2 = optionalTrimmedString(input.addressLine2);
    if (hasKey(input, "city")) next.city = optionalTrimmedString(input.city);
    if (hasKey(input, "region")) next.region = optionalTrimmedString(input.region);
    if (hasKey(input, "postalCode")) next.postalCode = optionalTrimmedString(input.postalCode);
    if (hasKey(input, "country")) next.country = optionalTrimmedString(input.country);
    if (hasKey(input, "latitude")) next.latitude = optionalNumber(input.latitude, "latitude", -90, 90);
    if (hasKey(input, "longitude")) next.longitude = optionalNumber(input.longitude, "longitude", -180, 180);
    if (hasKey(input, "deliveryRadiusKm")) {
      next.deliveryRadiusKm = optionalInteger(input.deliveryRadiusKm, "deliveryRadiusKm", 0);
    }
    if (hasKey(input, "pickupEnabled")) {
      const value = optionalBoolean(input.pickupEnabled);
      if (value === null) {
        throw new HttpError(400, "pickupEnabled must be a boolean");
      }
      next.pickupEnabled = value;
    }
    if (hasKey(input, "deliveryEnabled")) {
      const value = optionalBoolean(input.deliveryEnabled);
      if (value === null) {
        throw new HttpError(400, "deliveryEnabled must be a boolean");
      }
      next.deliveryEnabled = value;
    }
    if (hasKey(input, "notificationEmail")) {
      next.notificationEmail = optionalTrimmedString(input.notificationEmail);
    }

    next.updatedAt = nowIso();

    return this.repository.update("storeProfiles", id, () => next) ?? next;
  }

  deleteStoreProfile(id: string): StoreProfileRecord {
    const deleted = this.repository.delete("storeProfiles", id);
    if (!deleted) {
      throw new HttpError(404, "StoreProfile not found");
    }

    return deleted;
  }

  listInventoryItems(): InventoryItemRecord[] {
    return this.repository.list("inventoryItems");
  }

  getInventoryItem(id: string): InventoryItemRecord {
    return this.requireInventoryItem(id);
  }

  createInventoryItem(payload: unknown): InventoryItemRecord {
    const input = asRecord(payload, "inventoryItem");
    const now = nowIso();

    const businessId = requiredTrimmedString(input.businessId, "businessId");
    this.requireBusiness(businessId);

    const sku = optionalTrimmedString(input.sku);
    this.ensureUniqueInventorySku(businessId, sku);

    const record: InventoryItemRecord = {
      id: createId("inv"),
      businessId,
      sku,
      name: requiredTrimmedString(input.name, "name"),
      description: optionalTrimmedString(input.description),
      category: optionalTrimmedString(input.category),
      unitLabel: optionalTrimmedString(input.unitLabel),
      imageUrl: optionalTrimmedString(input.imageUrl),
      priceCents: integerOrDefault(input.priceCents, 0, "priceCents", 0),
      compareAtCents: optionalInteger(input.compareAtCents, "compareAtCents", 0),
      costCents: optionalInteger(input.costCents, "costCents", 0),
      quantityOnHand: integerOrDefault(input.quantityOnHand, 0, "quantityOnHand", 0),
      reservedQuantity: integerOrDefault(input.reservedQuantity, 0, "reservedQuantity", 0),
      lowStockThreshold: optionalInteger(input.lowStockThreshold, "lowStockThreshold", 0),
      expiresAt: optionalIsoDate(input.expiresAt, "expiresAt"),
      isActive: booleanOrDefault(input.isActive, true, "isActive"),
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create("inventoryItems", record);
  }

  updateInventoryItem(id: string, payload: unknown): InventoryItemRecord {
    const current = this.requireInventoryItem(id);
    const input = asRecord(payload, "inventoryItem patch");
    const next: InventoryItemRecord = { ...current };

    if (hasKey(input, "businessId")) {
      const businessId = requiredTrimmedString(input.businessId, "businessId");
      this.requireBusiness(businessId);
      next.businessId = businessId;
    }

    if (hasKey(input, "sku")) {
      next.sku = optionalTrimmedString(input.sku);
    }

    this.ensureUniqueInventorySku(next.businessId, next.sku, id);

    if (hasKey(input, "name")) next.name = requiredTrimmedString(input.name, "name");
    if (hasKey(input, "description")) next.description = optionalTrimmedString(input.description);
    if (hasKey(input, "category")) next.category = optionalTrimmedString(input.category);
    if (hasKey(input, "unitLabel")) next.unitLabel = optionalTrimmedString(input.unitLabel);
    if (hasKey(input, "imageUrl")) next.imageUrl = optionalTrimmedString(input.imageUrl);
    if (hasKey(input, "priceCents")) next.priceCents = integerOrDefault(input.priceCents, next.priceCents, "priceCents", 0);
    if (hasKey(input, "compareAtCents")) next.compareAtCents = optionalInteger(input.compareAtCents, "compareAtCents", 0);
    if (hasKey(input, "costCents")) next.costCents = optionalInteger(input.costCents, "costCents", 0);
    if (hasKey(input, "quantityOnHand")) next.quantityOnHand = integerOrDefault(input.quantityOnHand, next.quantityOnHand, "quantityOnHand", 0);
    if (hasKey(input, "reservedQuantity")) next.reservedQuantity = integerOrDefault(input.reservedQuantity, next.reservedQuantity, "reservedQuantity", 0);
    if (hasKey(input, "lowStockThreshold")) next.lowStockThreshold = optionalInteger(input.lowStockThreshold, "lowStockThreshold", 0);
    if (hasKey(input, "expiresAt")) next.expiresAt = optionalIsoDate(input.expiresAt, "expiresAt");
    if (hasKey(input, "isActive")) {
      const value = optionalBoolean(input.isActive);
      if (value === null) {
        throw new HttpError(400, "isActive must be a boolean");
      }
      next.isActive = value;
    }

    next.updatedAt = nowIso();

    return this.repository.update("inventoryItems", id, () => next) ?? next;
  }

  deleteInventoryItem(id: string): InventoryItemRecord {
    const deleted = this.repository.delete("inventoryItems", id);
    if (!deleted) {
      throw new HttpError(404, "InventoryItem not found");
    }

    return deleted;
  }

  listPricingRules(): PricingRuleRecord[] {
    return this.repository.list("pricingRules");
  }

  getPricingRule(id: string): PricingRuleRecord {
    return this.requirePricingRule(id);
  }

  createPricingRule(payload: unknown): PricingRuleRecord {
    const input = asRecord(payload, "pricingRule");
    const now = nowIso();

    const businessId = requiredTrimmedString(input.businessId, "businessId");
    this.requireBusiness(businessId);

    const inventoryItemId = optionalTrimmedString(input.inventoryItemId);
    if (inventoryItemId) {
      const item = this.requireInventoryItem(inventoryItemId);
      if (item.businessId !== businessId) {
        throw new HttpError(400, "inventoryItemId must belong to the same businessId");
      }
    }

    const record: PricingRuleRecord = {
      id: createId("rule"),
      businessId,
      inventoryItemId,
      name: requiredTrimmedString(input.name, "name"),
      description: optionalTrimmedString(input.description),
      ruleType: enumOrDefault(input.ruleType, "PERCENT_OFF", "ruleType", PRICING_RULE_TYPES),
      priority: integerOrDefault(input.priority, 100, "priority", 0),
      percentOff: optionalNumber(input.percentOff, "percentOff", 0),
      amountOffCents: optionalInteger(input.amountOffCents, "amountOffCents", 0),
      fixedPriceCents: optionalInteger(input.fixedPriceCents, "fixedPriceCents", 0),
      minQuantity: optionalInteger(input.minQuantity, "minQuantity", 1),
      startsAt: optionalIsoDate(input.startsAt, "startsAt"),
      endsAt: optionalIsoDate(input.endsAt, "endsAt"),
      maxRedemptions: optionalInteger(input.maxRedemptions, "maxRedemptions", 0),
      redemptionsUsed: integerOrDefault(input.redemptionsUsed, 0, "redemptionsUsed", 0),
      isActive: booleanOrDefault(input.isActive, true, "isActive"),
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create("pricingRules", record);
  }

  updatePricingRule(id: string, payload: unknown): PricingRuleRecord {
    const current = this.requirePricingRule(id);
    const input = asRecord(payload, "pricingRule patch");
    const next: PricingRuleRecord = { ...current };

    if (hasKey(input, "businessId")) {
      const businessId = requiredTrimmedString(input.businessId, "businessId");
      this.requireBusiness(businessId);
      next.businessId = businessId;
    }

    if (hasKey(input, "inventoryItemId")) {
      next.inventoryItemId = optionalTrimmedString(input.inventoryItemId);
    }

    if (next.inventoryItemId) {
      const item = this.requireInventoryItem(next.inventoryItemId);
      if (item.businessId !== next.businessId) {
        throw new HttpError(400, "inventoryItemId must belong to the same businessId");
      }
    }

    if (hasKey(input, "name")) next.name = requiredTrimmedString(input.name, "name");
    if (hasKey(input, "description")) next.description = optionalTrimmedString(input.description);
    if (hasKey(input, "ruleType")) {
      next.ruleType = enumOrDefault(
        input.ruleType,
        next.ruleType,
        "ruleType",
        PRICING_RULE_TYPES,
      ) as PricingRuleType;
    }
    if (hasKey(input, "priority")) next.priority = integerOrDefault(input.priority, next.priority, "priority", 0);
    if (hasKey(input, "percentOff")) next.percentOff = optionalNumber(input.percentOff, "percentOff", 0);
    if (hasKey(input, "amountOffCents")) next.amountOffCents = optionalInteger(input.amountOffCents, "amountOffCents", 0);
    if (hasKey(input, "fixedPriceCents")) next.fixedPriceCents = optionalInteger(input.fixedPriceCents, "fixedPriceCents", 0);
    if (hasKey(input, "minQuantity")) next.minQuantity = optionalInteger(input.minQuantity, "minQuantity", 1);
    if (hasKey(input, "startsAt")) next.startsAt = optionalIsoDate(input.startsAt, "startsAt");
    if (hasKey(input, "endsAt")) next.endsAt = optionalIsoDate(input.endsAt, "endsAt");
    if (hasKey(input, "maxRedemptions")) next.maxRedemptions = optionalInteger(input.maxRedemptions, "maxRedemptions", 0);
    if (hasKey(input, "redemptionsUsed")) next.redemptionsUsed = integerOrDefault(input.redemptionsUsed, next.redemptionsUsed, "redemptionsUsed", 0);
    if (hasKey(input, "isActive")) {
      const value = optionalBoolean(input.isActive);
      if (value === null) {
        throw new HttpError(400, "isActive must be a boolean");
      }
      next.isActive = value;
    }

    next.updatedAt = nowIso();

    return this.repository.update("pricingRules", id, () => next) ?? next;
  }

  deletePricingRule(id: string): PricingRuleRecord {
    const deleted = this.repository.delete("pricingRules", id);
    if (!deleted) {
      throw new HttpError(404, "PricingRule not found");
    }

    return deleted;
  }

  listOffers(): OfferRecord[] {
    return this.repository.list("offers");
  }

  getOffer(id: string): OfferRecord {
    return this.requireOffer(id);
  }

  createOffer(payload: unknown): OfferRecord {
    const input = asRecord(payload, "offer");
    const now = nowIso();

    const businessId = requiredTrimmedString(input.businessId, "businessId");
    this.requireBusiness(businessId);

    const inventoryItemId = optionalTrimmedString(input.inventoryItemId);
    if (inventoryItemId) {
      const item = this.requireInventoryItem(inventoryItemId);
      if (item.businessId !== businessId) {
        throw new HttpError(400, "inventoryItemId must belong to the same businessId");
      }
    }

    const pricingRuleId = optionalTrimmedString(input.pricingRuleId);
    if (pricingRuleId) {
      const rule = this.requirePricingRule(pricingRuleId);
      if (rule.businessId !== businessId) {
        throw new HttpError(400, "pricingRuleId must belong to the same businessId");
      }
    }

    const campaignId = optionalTrimmedString(input.campaignId);
    if (campaignId) {
      const campaign = this.requireCampaign(campaignId);
      if (campaign.businessId !== businessId) {
        throw new HttpError(400, "campaignId must belong to the same businessId");
      }
    }

    const couponCode = optionalTrimmedString(input.couponCode);
    this.ensureUniqueOfferCouponCode(businessId, couponCode);

    const record: OfferRecord = {
      id: createId("offer"),
      businessId,
      inventoryItemId,
      pricingRuleId,
      campaignId,
      title: requiredTrimmedString(input.title, "title"),
      description: optionalTrimmedString(input.description),
      status: enumOrDefault(input.status, "DRAFT", "status", OFFER_STATUSES),
      badgeText: optionalTrimmedString(input.badgeText),
      couponCode,
      discountPriceCents: optionalInteger(input.discountPriceCents, "discountPriceCents", 0),
      startsAt: optionalIsoDate(input.startsAt, "startsAt"),
      endsAt: optionalIsoDate(input.endsAt, "endsAt"),
      unitsTotal: optionalInteger(input.unitsTotal, "unitsTotal", 0),
      unitsClaimed: integerOrDefault(input.unitsClaimed, 0, "unitsClaimed", 0),
      ctaUrl: optionalTrimmedString(input.ctaUrl),
      featured: booleanOrDefault(input.featured, false, "featured"),
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create("offers", record);
  }

  updateOffer(id: string, payload: unknown): OfferRecord {
    const current = this.requireOffer(id);
    const input = asRecord(payload, "offer patch");
    const next: OfferRecord = { ...current };

    if (hasKey(input, "businessId")) {
      const businessId = requiredTrimmedString(input.businessId, "businessId");
      this.requireBusiness(businessId);
      next.businessId = businessId;
    }

    if (hasKey(input, "inventoryItemId")) {
      next.inventoryItemId = optionalTrimmedString(input.inventoryItemId);
    }

    if (hasKey(input, "pricingRuleId")) {
      next.pricingRuleId = optionalTrimmedString(input.pricingRuleId);
    }

    if (hasKey(input, "campaignId")) {
      next.campaignId = optionalTrimmedString(input.campaignId);
    }

    if (next.inventoryItemId) {
      const item = this.requireInventoryItem(next.inventoryItemId);
      if (item.businessId !== next.businessId) {
        throw new HttpError(400, "inventoryItemId must belong to the same businessId");
      }
    }

    if (next.pricingRuleId) {
      const rule = this.requirePricingRule(next.pricingRuleId);
      if (rule.businessId !== next.businessId) {
        throw new HttpError(400, "pricingRuleId must belong to the same businessId");
      }
    }

    if (next.campaignId) {
      const campaign = this.requireCampaign(next.campaignId);
      if (campaign.businessId !== next.businessId) {
        throw new HttpError(400, "campaignId must belong to the same businessId");
      }
    }

    if (hasKey(input, "title")) next.title = requiredTrimmedString(input.title, "title");
    if (hasKey(input, "description")) next.description = optionalTrimmedString(input.description);
    if (hasKey(input, "status")) {
      next.status = enumOrDefault(input.status, next.status, "status", OFFER_STATUSES) as OfferStatus;
    }
    if (hasKey(input, "badgeText")) next.badgeText = optionalTrimmedString(input.badgeText);
    if (hasKey(input, "couponCode")) next.couponCode = optionalTrimmedString(input.couponCode);
    this.ensureUniqueOfferCouponCode(next.businessId, next.couponCode, id);
    if (hasKey(input, "discountPriceCents")) next.discountPriceCents = optionalInteger(input.discountPriceCents, "discountPriceCents", 0);
    if (hasKey(input, "startsAt")) next.startsAt = optionalIsoDate(input.startsAt, "startsAt");
    if (hasKey(input, "endsAt")) next.endsAt = optionalIsoDate(input.endsAt, "endsAt");
    if (hasKey(input, "unitsTotal")) next.unitsTotal = optionalInteger(input.unitsTotal, "unitsTotal", 0);
    if (hasKey(input, "unitsClaimed")) next.unitsClaimed = integerOrDefault(input.unitsClaimed, next.unitsClaimed, "unitsClaimed", 0);
    if (hasKey(input, "ctaUrl")) next.ctaUrl = optionalTrimmedString(input.ctaUrl);
    if (hasKey(input, "featured")) {
      const value = optionalBoolean(input.featured);
      if (value === null) {
        throw new HttpError(400, "featured must be a boolean");
      }
      next.featured = value;
    }

    next.updatedAt = nowIso();

    return this.repository.update("offers", id, () => next) ?? next;
  }

  deleteOffer(id: string): OfferRecord {
    const deleted = this.repository.delete("offers", id);
    if (!deleted) {
      throw new HttpError(404, "Offer not found");
    }

    return deleted;
  }

  listCampaigns(): CampaignRecord[] {
    return this.repository.list("campaigns");
  }

  getCampaign(id: string): CampaignRecord {
    return this.requireCampaign(id);
  }

  createCampaign(payload: unknown): CampaignRecord {
    const input = asRecord(payload, "campaign");
    const now = nowIso();

    const businessId = requiredTrimmedString(input.businessId, "businessId");
    this.requireBusiness(businessId);

    const record: CampaignRecord = {
      id: createId("camp"),
      businessId,
      name: requiredTrimmedString(input.name, "name"),
      description: optionalTrimmedString(input.description),
      type: enumOrDefault(input.type, "PROMOTION", "type", CAMPAIGN_TYPES),
      status: enumOrDefault(input.status, "DRAFT", "status", CAMPAIGN_STATUSES),
      startsAt: optionalIsoDate(input.startsAt, "startsAt"),
      endsAt: optionalIsoDate(input.endsAt, "endsAt"),
      geofenceLatitude: optionalNumber(input.geofenceLatitude, "geofenceLatitude", -90, 90),
      geofenceLongitude: optionalNumber(input.geofenceLongitude, "geofenceLongitude", -180, 180),
      geofenceRadiusM: optionalInteger(input.geofenceRadiusM, "geofenceRadiusM", 0),
      budgetCents: optionalInteger(input.budgetCents, "budgetCents", 0),
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create("campaigns", record);
  }

  updateCampaign(id: string, payload: unknown): CampaignRecord {
    const current = this.requireCampaign(id);
    const input = asRecord(payload, "campaign patch");
    const next: CampaignRecord = { ...current };

    if (hasKey(input, "businessId")) {
      const businessId = requiredTrimmedString(input.businessId, "businessId");
      this.requireBusiness(businessId);
      next.businessId = businessId;
    }

    if (hasKey(input, "name")) next.name = requiredTrimmedString(input.name, "name");
    if (hasKey(input, "description")) next.description = optionalTrimmedString(input.description);
    if (hasKey(input, "type")) {
      next.type = enumOrDefault(input.type, next.type, "type", CAMPAIGN_TYPES) as CampaignType;
    }
    if (hasKey(input, "status")) {
      next.status = enumOrDefault(
        input.status,
        next.status,
        "status",
        CAMPAIGN_STATUSES,
      ) as CampaignStatus;
    }
    if (hasKey(input, "startsAt")) next.startsAt = optionalIsoDate(input.startsAt, "startsAt");
    if (hasKey(input, "endsAt")) next.endsAt = optionalIsoDate(input.endsAt, "endsAt");
    if (hasKey(input, "geofenceLatitude")) {
      next.geofenceLatitude = optionalNumber(input.geofenceLatitude, "geofenceLatitude", -90, 90);
    }
    if (hasKey(input, "geofenceLongitude")) {
      next.geofenceLongitude = optionalNumber(input.geofenceLongitude, "geofenceLongitude", -180, 180);
    }
    if (hasKey(input, "geofenceRadiusM")) {
      next.geofenceRadiusM = optionalInteger(input.geofenceRadiusM, "geofenceRadiusM", 0);
    }
    if (hasKey(input, "budgetCents")) {
      next.budgetCents = optionalInteger(input.budgetCents, "budgetCents", 0);
    }

    next.updatedAt = nowIso();

    return this.repository.update("campaigns", id, () => next) ?? next;
  }

  deleteCampaign(id: string): CampaignRecord {
    const deleted = this.repository.delete("campaigns", id);
    if (!deleted) {
      throw new HttpError(404, "Campaign not found");
    }

    return deleted;
  }

  listNotificationRecipients(): NotificationRecipientRecord[] {
    return this.repository.list("notificationRecipients");
  }

  getNotificationRecipient(id: string): NotificationRecipientRecord {
    return this.requireNotificationRecipient(id);
  }

  createNotificationRecipient(payload: unknown): NotificationRecipientRecord {
    const input = asRecord(payload, "notificationRecipient");
    const now = nowIso();

    const businessId = requiredTrimmedString(input.businessId, "businessId");
    this.requireBusiness(businessId);

    const email = optionalTrimmedString(input.email);
    const phone = optionalTrimmedString(input.phone);
    this.ensureUniqueNotificationRecipient(businessId, email, phone);

    const record: NotificationRecipientRecord = {
      id: createId("rcpt"),
      businessId,
      userId: optionalTrimmedString(input.userId),
      name: optionalTrimmedString(input.name),
      email,
      phone,
      pushToken: optionalTrimmedString(input.pushToken),
      preferredChannel: enumOrDefault(
        input.preferredChannel,
        "EMAIL",
        "preferredChannel",
        NOTIFICATION_CHANNELS,
      ) as NotificationChannel,
      emailOptIn: booleanOrDefault(input.emailOptIn, true, "emailOptIn"),
      smsOptIn: booleanOrDefault(input.smsOptIn, false, "smsOptIn"),
      pushOptIn: booleanOrDefault(input.pushOptIn, false, "pushOptIn"),
      tags: optionalObject(input.tags, "tags"),
      lastNotifiedAt: optionalIsoDate(input.lastNotifiedAt, "lastNotifiedAt"),
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create("notificationRecipients", record);
  }

  updateNotificationRecipient(id: string, payload: unknown): NotificationRecipientRecord {
    const current = this.requireNotificationRecipient(id);
    const input = asRecord(payload, "notificationRecipient patch");
    const next: NotificationRecipientRecord = { ...current };

    if (hasKey(input, "businessId")) {
      const businessId = requiredTrimmedString(input.businessId, "businessId");
      this.requireBusiness(businessId);
      next.businessId = businessId;
    }

    if (hasKey(input, "userId")) next.userId = optionalTrimmedString(input.userId);
    if (hasKey(input, "name")) next.name = optionalTrimmedString(input.name);
    if (hasKey(input, "email")) next.email = optionalTrimmedString(input.email);
    if (hasKey(input, "phone")) next.phone = optionalTrimmedString(input.phone);
    if (hasKey(input, "pushToken")) next.pushToken = optionalTrimmedString(input.pushToken);
    if (hasKey(input, "preferredChannel")) {
      next.preferredChannel = enumOrDefault(
        input.preferredChannel,
        next.preferredChannel,
        "preferredChannel",
        NOTIFICATION_CHANNELS,
      ) as NotificationChannel;
    }
    if (hasKey(input, "emailOptIn")) {
      const value = optionalBoolean(input.emailOptIn);
      if (value === null) {
        throw new HttpError(400, "emailOptIn must be a boolean");
      }
      next.emailOptIn = value;
    }
    if (hasKey(input, "smsOptIn")) {
      const value = optionalBoolean(input.smsOptIn);
      if (value === null) {
        throw new HttpError(400, "smsOptIn must be a boolean");
      }
      next.smsOptIn = value;
    }
    if (hasKey(input, "pushOptIn")) {
      const value = optionalBoolean(input.pushOptIn);
      if (value === null) {
        throw new HttpError(400, "pushOptIn must be a boolean");
      }
      next.pushOptIn = value;
    }
    if (hasKey(input, "tags")) next.tags = optionalObject(input.tags, "tags");
    if (hasKey(input, "lastNotifiedAt")) {
      next.lastNotifiedAt = optionalIsoDate(input.lastNotifiedAt, "lastNotifiedAt");
    }

    this.ensureUniqueNotificationRecipient(next.businessId, next.email, next.phone, id);

    next.updatedAt = nowIso();

    return this.repository.update("notificationRecipients", id, () => next) ?? next;
  }

  deleteNotificationRecipient(id: string): NotificationRecipientRecord {
    const deleted = this.repository.delete("notificationRecipients", id);
    if (!deleted) {
      throw new HttpError(404, "NotificationRecipient not found");
    }

    return deleted;
  }

  listDeliveryLeads(): DeliveryLeadRecord[] {
    return this.repository.list("deliveryLeads");
  }

  getDeliveryLead(id: string): DeliveryLeadRecord {
    return this.requireDeliveryLead(id);
  }

  createDeliveryLead(payload: unknown): DeliveryLeadRecord {
    const input = asRecord(payload, "deliveryLead");
    const now = nowIso();

    const businessId = requiredTrimmedString(input.businessId, "businessId");
    this.requireBusiness(businessId);

    const inventoryItemId = optionalTrimmedString(input.inventoryItemId);
    if (inventoryItemId) {
      const item = this.requireInventoryItem(inventoryItemId);
      if (item.businessId !== businessId) {
        throw new HttpError(400, "inventoryItemId must belong to the same businessId");
      }
    }

    const offerId = optionalTrimmedString(input.offerId);
    if (offerId) {
      const offer = this.requireOffer(offerId);
      if (offer.businessId !== businessId) {
        throw new HttpError(400, "offerId must belong to the same businessId");
      }
    }

    const recipientId = optionalTrimmedString(input.recipientId);
    if (recipientId) {
      const recipient = this.requireNotificationRecipient(recipientId);
      if (recipient.businessId !== businessId) {
        throw new HttpError(400, "recipientId must belong to the same businessId");
      }
    }

    const record: DeliveryLeadRecord = {
      id: createId("lead"),
      businessId,
      inventoryItemId,
      offerId,
      recipientId,
      userId: optionalTrimmedString(input.userId),
      source: enumOrDefault(input.source, "ARTICLE_CTA", "source", DELIVERY_LEAD_SOURCES) as DeliveryLeadSource,
      status: enumOrDefault(input.status, "NEW", "status", DELIVERY_LEAD_STATUSES) as DeliveryLeadStatus,
      requestedQty: integerOrDefault(input.requestedQty, 1, "requestedQty", 1),
      unitPriceCents: optionalInteger(input.unitPriceCents, "unitPriceCents", 0),
      totalCents: optionalInteger(input.totalCents, "totalCents", 0),
      requestedAt: hasKey(input, "requestedAt")
        ? requiredIsoDate(input.requestedAt, "requestedAt")
        : now,
      fulfillBy: optionalIsoDate(input.fulfillBy, "fulfillBy"),
      contactedAt: optionalIsoDate(input.contactedAt, "contactedAt"),
      fulfilledAt: optionalIsoDate(input.fulfilledAt, "fulfilledAt"),
      cancelledAt: optionalIsoDate(input.cancelledAt, "cancelledAt"),
      deliveryAddress: optionalTrimmedString(input.deliveryAddress),
      notes: optionalTrimmedString(input.notes),
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.create("deliveryLeads", record);
  }

  updateDeliveryLead(id: string, payload: unknown): DeliveryLeadRecord {
    const current = this.requireDeliveryLead(id);
    const input = asRecord(payload, "deliveryLead patch");
    const next: DeliveryLeadRecord = { ...current };

    if (hasKey(input, "businessId")) {
      const businessId = requiredTrimmedString(input.businessId, "businessId");
      this.requireBusiness(businessId);
      next.businessId = businessId;
    }

    if (hasKey(input, "inventoryItemId")) {
      next.inventoryItemId = optionalTrimmedString(input.inventoryItemId);
    }
    if (hasKey(input, "offerId")) {
      next.offerId = optionalTrimmedString(input.offerId);
    }
    if (hasKey(input, "recipientId")) {
      next.recipientId = optionalTrimmedString(input.recipientId);
    }

    if (next.inventoryItemId) {
      const item = this.requireInventoryItem(next.inventoryItemId);
      if (item.businessId !== next.businessId) {
        throw new HttpError(400, "inventoryItemId must belong to the same businessId");
      }
    }

    if (next.offerId) {
      const offer = this.requireOffer(next.offerId);
      if (offer.businessId !== next.businessId) {
        throw new HttpError(400, "offerId must belong to the same businessId");
      }
    }

    if (next.recipientId) {
      const recipient = this.requireNotificationRecipient(next.recipientId);
      if (recipient.businessId !== next.businessId) {
        throw new HttpError(400, "recipientId must belong to the same businessId");
      }
    }

    if (hasKey(input, "userId")) next.userId = optionalTrimmedString(input.userId);
    if (hasKey(input, "source")) {
      const source = optionalEnum(input.source, "source", DELIVERY_LEAD_SOURCES);
      if (!source) {
        throw new HttpError(400, "source is required");
      }
      next.source = source;
    }
    if (hasKey(input, "status")) {
      const status = optionalEnum(input.status, "status", DELIVERY_LEAD_STATUSES);
      if (!status) {
        throw new HttpError(400, "status is required");
      }
      next.status = status;
    }
    if (hasKey(input, "requestedQty")) next.requestedQty = integerOrDefault(input.requestedQty, next.requestedQty, "requestedQty", 1);
    if (hasKey(input, "unitPriceCents")) next.unitPriceCents = optionalInteger(input.unitPriceCents, "unitPriceCents", 0);
    if (hasKey(input, "totalCents")) next.totalCents = optionalInteger(input.totalCents, "totalCents", 0);
    if (hasKey(input, "requestedAt")) next.requestedAt = requiredIsoDate(input.requestedAt, "requestedAt");
    if (hasKey(input, "fulfillBy")) next.fulfillBy = optionalIsoDate(input.fulfillBy, "fulfillBy");
    if (hasKey(input, "contactedAt")) next.contactedAt = optionalIsoDate(input.contactedAt, "contactedAt");
    if (hasKey(input, "fulfilledAt")) next.fulfilledAt = optionalIsoDate(input.fulfilledAt, "fulfilledAt");
    if (hasKey(input, "cancelledAt")) next.cancelledAt = optionalIsoDate(input.cancelledAt, "cancelledAt");
    if (hasKey(input, "deliveryAddress")) next.deliveryAddress = optionalTrimmedString(input.deliveryAddress);
    if (hasKey(input, "notes")) next.notes = optionalTrimmedString(input.notes);

    next.updatedAt = nowIso();

    return this.repository.update("deliveryLeads", id, () => next) ?? next;
  }

  deleteDeliveryLead(id: string): DeliveryLeadRecord {
    const deleted = this.repository.delete("deliveryLeads", id);
    if (!deleted) {
      throw new HttpError(404, "DeliveryLead not found");
    }

    return deleted;
  }

  listAffiliateClicks(): AffiliateClickRecord[] {
    return this.repository.list("affiliateClicks");
  }

  getAffiliateClick(id: string): AffiliateClickRecord {
    return this.requireAffiliateClick(id);
  }

  createAffiliateClick(payload: unknown): AffiliateClickRecord {
    const input = asRecord(payload, "affiliateClick");
    const now = nowIso();

    const businessId = optionalTrimmedString(input.businessId);
    if (businessId) {
      this.requireBusiness(businessId);
    }

    const campaignId = optionalTrimmedString(input.campaignId);
    if (campaignId) {
      const campaign = this.requireCampaign(campaignId);
      if (businessId && campaign.businessId !== businessId) {
        throw new HttpError(400, "campaignId must belong to businessId");
      }
    }

    const record: AffiliateClickRecord = {
      id: createId("click"),
      businessId,
      campaignId,
      articleId: optionalTrimmedString(input.articleId),
      userId: optionalTrimmedString(input.userId),
      network: enumOrDefault(input.network, "AMAZON", "network", AFFILIATE_NETWORKS),
      sourceContext: optionalTrimmedString(input.sourceContext),
      destinationUrl: requiredTrimmedString(input.destinationUrl, "destinationUrl"),
      referrerUrl: optionalTrimmedString(input.referrerUrl),
      ipHash: optionalTrimmedString(input.ipHash),
      userAgent: optionalTrimmedString(input.userAgent),
      createdAt: hasKey(input, "createdAt") ? requiredIsoDate(input.createdAt, "createdAt") : now,
    };

    return this.repository.create("affiliateClicks", record);
  }

  updateAffiliateClick(id: string, payload: unknown): AffiliateClickRecord {
    const current = this.requireAffiliateClick(id);
    const input = asRecord(payload, "affiliateClick patch");
    const next: AffiliateClickRecord = { ...current };

    if (hasKey(input, "businessId")) {
      next.businessId = optionalTrimmedString(input.businessId);
      if (next.businessId) {
        this.requireBusiness(next.businessId);
      }
    }

    if (hasKey(input, "campaignId")) {
      next.campaignId = optionalTrimmedString(input.campaignId);
    }

    if (next.campaignId) {
      const campaign = this.requireCampaign(next.campaignId);
      if (next.businessId && campaign.businessId !== next.businessId) {
        throw new HttpError(400, "campaignId must belong to businessId");
      }
    }

    if (hasKey(input, "articleId")) next.articleId = optionalTrimmedString(input.articleId);
    if (hasKey(input, "userId")) next.userId = optionalTrimmedString(input.userId);
    if (hasKey(input, "network")) {
      next.network = enumOrDefault(input.network, next.network, "network", AFFILIATE_NETWORKS);
    }
    if (hasKey(input, "sourceContext")) next.sourceContext = optionalTrimmedString(input.sourceContext);
    if (hasKey(input, "destinationUrl")) next.destinationUrl = requiredTrimmedString(input.destinationUrl, "destinationUrl");
    if (hasKey(input, "referrerUrl")) next.referrerUrl = optionalTrimmedString(input.referrerUrl);
    if (hasKey(input, "ipHash")) next.ipHash = optionalTrimmedString(input.ipHash);
    if (hasKey(input, "userAgent")) next.userAgent = optionalTrimmedString(input.userAgent);
    if (hasKey(input, "createdAt")) next.createdAt = requiredIsoDate(input.createdAt, "createdAt");

    return this.repository.update("affiliateClicks", id, () => next) ?? next;
  }

  deleteAffiliateClick(id: string): AffiliateClickRecord {
    const deleted = this.repository.delete("affiliateClicks", id);
    if (!deleted) {
      throw new HttpError(404, "AffiliateClick not found");
    }

    return deleted;
  }

  listRewardLedger(): RewardLedgerRecord[] {
    return this.repository.list("rewardLedger");
  }

  getRewardLedger(id: string): RewardLedgerRecord {
    return this.requireRewardLedger(id);
  }

  createRewardLedger(payload: unknown): RewardLedgerRecord {
    const input = asRecord(payload, "rewardLedger");
    const now = nowIso();

    const businessId = optionalTrimmedString(input.businessId);
    if (businessId) {
      this.requireBusiness(businessId);
    }

    const campaignId = optionalTrimmedString(input.campaignId);
    if (campaignId) {
      const campaign = this.requireCampaign(campaignId);
      if (businessId && campaign.businessId !== businessId) {
        throw new HttpError(400, "campaignId must belong to businessId");
      }
    }

    const externalRef = optionalTrimmedString(input.externalRef);
    this.ensureUniqueRewardExternalRef(externalRef);

    const record: RewardLedgerRecord = {
      id: createId("rwd"),
      businessId,
      campaignId,
      userId: optionalTrimmedString(input.userId),
      token: enumOrDefault(input.token, "WHEAT", "token", REWARD_TOKENS) as RewardToken,
      direction: enumOrDefault(
        input.direction,
        "CREDIT",
        "direction",
        REWARD_DIRECTIONS,
      ) as RewardDirection,
      amount: numberOrDefault(input.amount, 0, "amount"),
      reason: requiredTrimmedString(input.reason, "reason"),
      metadata: optionalObject(input.metadata, "metadata"),
      externalRef,
      createdAt: hasKey(input, "createdAt") ? requiredIsoDate(input.createdAt, "createdAt") : now,
    };

    if (record.amount === 0) {
      throw new HttpError(400, "amount must be non-zero");
    }

    return this.repository.create("rewardLedger", record);
  }

  updateRewardLedger(id: string, payload: unknown): RewardLedgerRecord {
    const current = this.requireRewardLedger(id);
    const input = asRecord(payload, "rewardLedger patch");
    const next: RewardLedgerRecord = { ...current };

    if (hasKey(input, "businessId")) {
      next.businessId = optionalTrimmedString(input.businessId);
      if (next.businessId) {
        this.requireBusiness(next.businessId);
      }
    }

    if (hasKey(input, "campaignId")) {
      next.campaignId = optionalTrimmedString(input.campaignId);
    }

    if (next.campaignId) {
      const campaign = this.requireCampaign(next.campaignId);
      if (next.businessId && campaign.businessId !== next.businessId) {
        throw new HttpError(400, "campaignId must belong to businessId");
      }
    }

    if (hasKey(input, "userId")) next.userId = optionalTrimmedString(input.userId);
    if (hasKey(input, "token")) {
      next.token = enumOrDefault(input.token, next.token, "token", REWARD_TOKENS) as RewardToken;
    }
    if (hasKey(input, "direction")) {
      next.direction = enumOrDefault(
        input.direction,
        next.direction,
        "direction",
        REWARD_DIRECTIONS,
      ) as RewardDirection;
    }
    if (hasKey(input, "amount")) {
      next.amount = numberOrDefault(input.amount, next.amount, "amount");
      if (next.amount === 0) {
        throw new HttpError(400, "amount must be non-zero");
      }
    }
    if (hasKey(input, "reason")) next.reason = requiredTrimmedString(input.reason, "reason");
    if (hasKey(input, "metadata")) next.metadata = optionalObject(input.metadata, "metadata");
    if (hasKey(input, "externalRef")) {
      next.externalRef = optionalTrimmedString(input.externalRef);
      this.ensureUniqueRewardExternalRef(next.externalRef, id);
    }
    if (hasKey(input, "createdAt")) next.createdAt = requiredIsoDate(input.createdAt, "createdAt");

    return this.repository.update("rewardLedger", id, () => next) ?? next;
  }

  deleteRewardLedger(id: string): RewardLedgerRecord {
    const deleted = this.repository.delete("rewardLedger", id);
    if (!deleted) {
      throw new HttpError(404, "RewardLedger entry not found");
    }

    return deleted;
  }

  counts(): Record<string, number> {
    return this.repository.counts();
  }
}
