export type UserRole = "OWNER" | "ADMIN" | "EDITOR" | "CONTRIBUTOR" | "USER";

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

export interface AuthSessionRecord {
  id: string;
  userId: string;
  accessToken: string;
  issuedAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
}

export type PublicAuthSession = Omit<AuthSessionRecord, "accessToken">;

export function toPublicAuthSession(session: AuthSessionRecord): PublicAuthSession {
  const { accessToken: _accessToken, ...safe } = session;
  return safe;
}

export type ArticleStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

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
export type NotificationStatus =
  | "queued"
  | "processing"
  | "retrying"
  | "sent"
  | "failed";

export type NotificationAuditEvent =
  | "queued"
  | "attempt_started"
  | "attempt_succeeded"
  | "attempt_failed"
  | "retry_scheduled"
  | "failed_final"
  | "retry_requested";

export interface NotificationJobRecord {
  id: string;
  businessId: string;
  channel: NotificationChannel;
  audience: string;
  subject: string | null;
  message: string;
  metadata: Record<string, unknown> | null;
  status: NotificationStatus;
  provider: string | null;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  lastAttemptAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationAuditLogRecord {
  id: string;
  jobId: string;
  event: NotificationAuditEvent;
  channel: NotificationChannel;
  provider: string | null;
  attempt: number | null;
  message: string;
  detail: Record<string, unknown> | null;
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

export type WalletChainType = "COSMOS";

export interface WalletLinkRecord {
  id: string;
  userId: string;
  chainType: WalletChainType;
  walletAddress: string;
  walletAddressPrefix: string;
  publicKeyBase64: string;
  linkedAt: string;
  lastVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletLinkChallengeRecord {
  id: string;
  userId: string;
  chainType: WalletChainType;
  walletAddress: string;
  nonce: string;
  message: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export type PublicWalletLink = Omit<
  WalletLinkRecord,
  "publicKeyBase64" | "walletAddressPrefix" | "updatedAt"
>;

export function toPublicWalletLink(link: WalletLinkRecord): PublicWalletLink {
  const {
    publicKeyBase64: _publicKeyBase64,
    walletAddressPrefix: _walletAddressPrefix,
    updatedAt: _updatedAt,
    ...safe
  } = link;
  return safe;
}
