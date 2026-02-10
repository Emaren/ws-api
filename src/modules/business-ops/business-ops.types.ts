export const BUSINESS_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const PRICING_RULE_TYPES = [
  "PERCENT_OFF",
  "AMOUNT_OFF",
  "FIXED_PRICE",
  "BOGO",
  "CLEARANCE",
] as const;
export type PricingRuleType = (typeof PRICING_RULE_TYPES)[number];

export const OFFER_STATUSES = ["DRAFT", "LIVE", "PAUSED", "EXPIRED", "ARCHIVED"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const CAMPAIGN_TYPES = [
  "PROMOTION",
  "GEO_DROP",
  "INVENTORY_FLASH",
  "LOYALTY",
  "AFFILIATE",
] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ["EMAIL", "SMS", "PUSH"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const DELIVERY_LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "RESERVED",
  "FULFILLED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type DeliveryLeadStatus = (typeof DELIVERY_LEAD_STATUSES)[number];

export const DELIVERY_LEAD_SOURCES = [
  "ARTICLE_CTA",
  "LOCAL_AD",
  "INVENTORY_ALERT",
  "CAMPAIGN_CLICK",
  "AFFILIATE",
] as const;
export type DeliveryLeadSource = (typeof DELIVERY_LEAD_SOURCES)[number];

export const AFFILIATE_NETWORKS = ["AMAZON", "LOCAL_DIRECT", "TOKENTAP", "OTHER"] as const;
export type AffiliateNetwork = (typeof AFFILIATE_NETWORKS)[number];

export const REWARD_TOKENS = ["WHEAT", "STONE"] as const;
export type RewardToken = (typeof REWARD_TOKENS)[number];

export const REWARD_DIRECTIONS = ["CREDIT", "DEBIT"] as const;
export type RewardDirection = (typeof REWARD_DIRECTIONS)[number];

export interface BusinessOpsBusinessRecord {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  ownerUserId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  timezone: string;
  status: BusinessStatus;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreProfileRecord {
  id: string;
  businessId: string;
  displayName: string | null;
  description: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  websiteUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryRadiusKm: number | null;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  notificationEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemRecord {
  id: string;
  businessId: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unitLabel: string | null;
  imageUrl: string | null;
  priceCents: number;
  compareAtCents: number | null;
  costCents: number | null;
  quantityOnHand: number;
  reservedQuantity: number;
  lowStockThreshold: number | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PricingRuleRecord {
  id: string;
  businessId: string;
  inventoryItemId: string | null;
  name: string;
  description: string | null;
  ruleType: PricingRuleType;
  priority: number;
  percentOff: number | null;
  amountOffCents: number | null;
  fixedPriceCents: number | null;
  minQuantity: number | null;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  redemptionsUsed: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfferRecord {
  id: string;
  businessId: string;
  inventoryItemId: string | null;
  pricingRuleId: string | null;
  campaignId: string | null;
  title: string;
  description: string | null;
  status: OfferStatus;
  badgeText: string | null;
  couponCode: string | null;
  discountPriceCents: number | null;
  startsAt: string | null;
  endsAt: string | null;
  unitsTotal: number | null;
  unitsClaimed: number;
  ctaUrl: string | null;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRecord {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  type: CampaignType;
  status: CampaignStatus;
  startsAt: string | null;
  endsAt: string | null;
  geofenceLatitude: number | null;
  geofenceLongitude: number | null;
  geofenceRadiusM: number | null;
  budgetCents: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecipientRecord {
  id: string;
  businessId: string;
  userId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  pushToken: string | null;
  preferredChannel: NotificationChannel;
  emailOptIn: boolean;
  smsOptIn: boolean;
  pushOptIn: boolean;
  tags: Record<string, unknown> | null;
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryLeadRecord {
  id: string;
  businessId: string;
  inventoryItemId: string | null;
  offerId: string | null;
  recipientId: string | null;
  userId: string | null;
  source: DeliveryLeadSource;
  status: DeliveryLeadStatus;
  requestedQty: number;
  unitPriceCents: number | null;
  totalCents: number | null;
  requestedAt: string;
  fulfillBy: string | null;
  contactedAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateClickRecord {
  id: string;
  businessId: string | null;
  campaignId: string | null;
  articleId: string | null;
  userId: string | null;
  network: AffiliateNetwork;
  sourceContext: string | null;
  destinationUrl: string;
  referrerUrl: string | null;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface RewardLedgerRecord {
  id: string;
  businessId: string | null;
  campaignId: string | null;
  userId: string | null;
  token: RewardToken;
  direction: RewardDirection;
  amount: number;
  reason: string;
  metadata: Record<string, unknown> | null;
  externalRef: string | null;
  createdAt: string;
}

export type BusinessOpsEntityMap = {
  businesses: BusinessOpsBusinessRecord;
  storeProfiles: StoreProfileRecord;
  inventoryItems: InventoryItemRecord;
  pricingRules: PricingRuleRecord;
  offers: OfferRecord;
  campaigns: CampaignRecord;
  notificationRecipients: NotificationRecipientRecord;
  deliveryLeads: DeliveryLeadRecord;
  affiliateClicks: AffiliateClickRecord;
  rewardLedger: RewardLedgerRecord;
};

export type BusinessOpsEntityName = keyof BusinessOpsEntityMap;
