export type UserRole = "OWNER" | "ADMIN" | "CONTRIBUTOR" | "STONEHOLDER";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type PublicUser = Omit<UserRecord, "passwordHash">;

export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export type ArticleStatus = "DRAFT" | "PUBLISHED";

export interface ArticleRecord {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  content: string;
  status: ArticleStatus;
  authorId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessRecord {
  id: string;
  name: string;
  ownerUserId: string;
  contactEmail: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemRecord {
  id: string;
  businessId: string;
  name: string;
  priceCents: number;
  discountedPriceCents: number | null;
  discountEndsAt: string | null;
  unitsLeft: number;
  createdAt: string;
  updatedAt: string;
}

export type NotificationChannel = "email" | "sms" | "push";
export type NotificationStatus = "queued" | "sent" | "failed";

export interface NotificationJobRecord {
  id: string;
  businessId: string;
  channel: NotificationChannel;
  audience: string;
  message: string;
  status: NotificationStatus;
  createdAt: string;
}

export type BillingPlan = "FREE" | "BASIC" | "PRO";
export type BillingStatus = "inactive" | "active" | "past_due";

export interface BillingCustomerRecord {
  id: string;
  userId: string;
  plan: BillingPlan;
  stripeCustomerId: string | null;
  status: BillingStatus;
  periodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RewardToken = "WHEAT" | "STONE";

export interface RewardLedgerEntryRecord {
  id: string;
  userId: string;
  token: RewardToken;
  amount: number;
  reason: string;
  metadata: string | null;
  createdAt: string;
}
