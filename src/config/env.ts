import dotenv from "dotenv";
import type { LogLevel } from "../shared/logger.js";

dotenv.config();

type NodeEnv = "development" | "test" | "production";
type NotificationEmailProviderName = "resend" | "dev";
type NotificationPushProviderName = "webpush" | "noop";

function readTrimmedEnv(name: string): string | undefined {
  const rawValue = process.env[name];
  if (!rawValue) {
    return undefined;
  }

  const value = rawValue.trim();
  return value.length > 0 ? value : undefined;
}

function parsePort(rawValue: string | undefined): number {
  const fallback = 3012;
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${rawValue}`);
  }

  return parsed;
}

function parsePositiveInt(
  rawValue: string | undefined,
  fallback: number,
  label: string,
): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsed;
}

function parseOrigins(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function parseNodeEnv(rawValue: string | undefined): NodeEnv {
  if (!rawValue) {
    return "development";
  }

  if (rawValue === "development" || rawValue === "test" || rawValue === "production") {
    return rawValue;
  }

  throw new Error(`Invalid NODE_ENV value: ${rawValue}`);
}

function parseLogLevel(rawValue: string | undefined): LogLevel {
  if (!rawValue) {
    return "info";
  }

  const value = rawValue.toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  throw new Error(`Invalid LOG_LEVEL value: ${rawValue}`);
}

function parseBoolean(rawValue: string | undefined, fallback: boolean): boolean {
  if (!rawValue) {
    return fallback;
  }

  const value = rawValue.toLowerCase();
  if (value === "1" || value === "true" || value === "yes") {
    return true;
  }

  if (value === "0" || value === "false" || value === "no") {
    return false;
  }

  throw new Error(`Invalid boolean value: ${rawValue}`);
}

function parseNotificationProviderName(
  rawValue: string | undefined,
): NotificationEmailProviderName {
  if (!rawValue) {
    return "dev";
  }

  const value = rawValue.toLowerCase();
  if (value === "resend" || value === "dev") {
    return value;
  }

  throw new Error(`Invalid NOTIFICATION_EMAIL_PROVIDER value: ${rawValue}`);
}

function parseNotificationPushProviderName(
  rawValue: string | undefined,
): NotificationPushProviderName {
  if (!rawValue) {
    return "noop";
  }

  const value = rawValue.toLowerCase();
  if (value === "webpush" || value === "noop") {
    return value;
  }

  throw new Error(`Invalid NOTIFICATION_PUSH_PROVIDER value: ${rawValue}`);
}

function parseUrl(rawValue: string | undefined, fallback: string, label: string): string {
  const value = rawValue ?? fallback;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  return value;
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseBindHost(rawValue: string | undefined): string {
  const value = (rawValue ?? "127.0.0.1").trim();
  if (!value) {
    return "127.0.0.1";
  }
  if (/\s/.test(value)) {
    throw new Error("BIND_HOST must not contain whitespace");
  }
  return value;
}

export interface AppEnv {
  nodeEnv: NodeEnv;
  serviceName: string;
  port: number;
  bindHost: string;
  logLevel: LogLevel;
  corsOrigins: string[];
  allowWildcardCorsInProduction: boolean;
  authSessionTtlSeconds: number;
  bootstrapAdminEmail: string | undefined;
  bootstrapAdminPassword: string | undefined;
  bootstrapAdminName: string;
  notificationMaxAttempts: number;
  notificationRetryBaseMs: number;
  notificationRetryMaxMs: number;
  notificationDefaultSubject: string;
  notificationEmailProvider: NotificationEmailProviderName;
  notificationEmailApiKey: string | undefined;
  notificationEmailFrom: string | undefined;
  notificationEmailApiBaseUrl: string;
  notificationPushProvider: NotificationPushProviderName;
  notificationPushVapidSubject: string;
  notificationPushVapidPublicKey: string | undefined;
  notificationPushVapidPrivateKey: string | undefined;
  storePath: string;
  storeFlushIntervalMs: number;
}

function validateEnv(env: AppEnv): AppEnv {
  if (!env.serviceName.trim()) {
    throw new Error("SERVICE_NAME must be non-empty");
  }

  if (!env.bindHost.trim()) {
    throw new Error("BIND_HOST must be non-empty");
  }

  const hasBootstrapEmail = Boolean(env.bootstrapAdminEmail);
  const hasBootstrapPassword = Boolean(env.bootstrapAdminPassword);

  if (hasBootstrapEmail !== hasBootstrapPassword) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set together");
  }

  if (env.bootstrapAdminEmail && !isLikelyEmail(env.bootstrapAdminEmail)) {
    throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email");
  }

  if (env.bootstrapAdminPassword && env.bootstrapAdminPassword.length < 8) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters");
  }

  if (
    env.nodeEnv === "production" &&
    env.corsOrigins.length === 0 &&
    !env.allowWildcardCorsInProduction
  ) {
    throw new Error(
      "In production, set CORS_ORIGINS or enable CORS_ALLOW_WILDCARD_IN_PROD=true",
    );
  }

  if (env.authSessionTtlSeconds < 60) {
    throw new Error("AUTH_SESSION_TTL_SECONDS must be at least 60");
  }

  if (env.notificationMaxAttempts < 1) {
    throw new Error("NOTIFICATION_MAX_ATTEMPTS must be at least 1");
  }

  if (env.notificationRetryBaseMs < 100) {
    throw new Error("NOTIFICATION_RETRY_BASE_MS must be at least 100");
  }

  if (env.notificationRetryMaxMs < env.notificationRetryBaseMs) {
    throw new Error("NOTIFICATION_RETRY_MAX_MS must be >= NOTIFICATION_RETRY_BASE_MS");
  }

  if (!env.notificationDefaultSubject.trim()) {
    throw new Error("NOTIFICATION_DEFAULT_SUBJECT must be non-empty");
  }

  if (
    env.notificationEmailProvider === "resend" &&
    (!env.notificationEmailApiKey || !env.notificationEmailFrom)
  ) {
    throw new Error(
      "NOTIFICATION_EMAIL_PROVIDER=resend requires NOTIFICATION_EMAIL_API_KEY and NOTIFICATION_EMAIL_FROM",
    );
  }

  if (env.notificationEmailFrom && !isLikelyEmail(env.notificationEmailFrom)) {
    throw new Error("NOTIFICATION_EMAIL_FROM must be a valid email");
  }

  if (
    env.notificationPushProvider === "webpush" &&
    (!env.notificationPushVapidPublicKey || !env.notificationPushVapidPrivateKey)
  ) {
    throw new Error(
      "NOTIFICATION_PUSH_PROVIDER=webpush requires NOTIFICATION_PUSH_VAPID_PUBLIC_KEY and NOTIFICATION_PUSH_VAPID_PRIVATE_KEY",
    );
  }

  if (
    env.notificationPushProvider === "webpush" &&
    !(
      env.notificationPushVapidSubject.startsWith("mailto:") ||
      env.notificationPushVapidSubject.startsWith("https://") ||
      env.notificationPushVapidSubject.startsWith("http://")
    )
  ) {
    throw new Error(
      "NOTIFICATION_PUSH_VAPID_SUBJECT must start with mailto:, http://, or https://",
    );
  }

  return env;
}

export function loadEnv(): AppEnv {
  const env: AppEnv = {
    nodeEnv: parseNodeEnv(readTrimmedEnv("NODE_ENV")),
    serviceName: readTrimmedEnv("SERVICE_NAME") ?? "ws-api",
    port: parsePort(readTrimmedEnv("PORT")),
    bindHost: parseBindHost(readTrimmedEnv("BIND_HOST") ?? readTrimmedEnv("HOST")),
    logLevel: parseLogLevel(readTrimmedEnv("LOG_LEVEL")),
    storePath: readTrimmedEnv("STORE_PATH") ?? "./.data/ws-api-store.json",
    storeFlushIntervalMs: parsePositiveInt(
      readTrimmedEnv("STORE_FLUSH_INTERVAL_MS"),
      5000,
      "STORE_FLUSH_INTERVAL_MS",
    ),
    corsOrigins: parseOrigins(readTrimmedEnv("CORS_ORIGINS")),
    allowWildcardCorsInProduction: parseBoolean(
      readTrimmedEnv("CORS_ALLOW_WILDCARD_IN_PROD"),
      true,
    ),
    authSessionTtlSeconds: parsePositiveInt(
      readTrimmedEnv("AUTH_SESSION_TTL_SECONDS"),
      60 * 60 * 24 * 7,
      "AUTH_SESSION_TTL_SECONDS",
    ),
    bootstrapAdminEmail: readTrimmedEnv("BOOTSTRAP_ADMIN_EMAIL"),
    bootstrapAdminPassword: readTrimmedEnv("BOOTSTRAP_ADMIN_PASSWORD"),
    bootstrapAdminName: readTrimmedEnv("BOOTSTRAP_ADMIN_NAME") ?? "Owner",
    notificationMaxAttempts: parsePositiveInt(
      readTrimmedEnv("NOTIFICATION_MAX_ATTEMPTS"),
      3,
      "NOTIFICATION_MAX_ATTEMPTS",
    ),
    notificationRetryBaseMs: parsePositiveInt(
      readTrimmedEnv("NOTIFICATION_RETRY_BASE_MS"),
      1_000,
      "NOTIFICATION_RETRY_BASE_MS",
    ),
    notificationRetryMaxMs: parsePositiveInt(
      readTrimmedEnv("NOTIFICATION_RETRY_MAX_MS"),
      60_000,
      "NOTIFICATION_RETRY_MAX_MS",
    ),
    notificationDefaultSubject:
      readTrimmedEnv("NOTIFICATION_DEFAULT_SUBJECT") ?? "Wheat & Stone Notification",
    notificationEmailProvider: parseNotificationProviderName(
      readTrimmedEnv("NOTIFICATION_EMAIL_PROVIDER"),
    ),
    notificationEmailApiKey: readTrimmedEnv("NOTIFICATION_EMAIL_API_KEY"),
    notificationEmailFrom: readTrimmedEnv("NOTIFICATION_EMAIL_FROM"),
    notificationEmailApiBaseUrl: parseUrl(
      readTrimmedEnv("NOTIFICATION_EMAIL_API_BASE_URL"),
      "https://api.resend.com",
      "NOTIFICATION_EMAIL_API_BASE_URL",
    ),
    notificationPushProvider: parseNotificationPushProviderName(
      readTrimmedEnv("NOTIFICATION_PUSH_PROVIDER"),
    ),
    notificationPushVapidSubject:
      readTrimmedEnv("NOTIFICATION_PUSH_VAPID_SUBJECT") ??
      "mailto:notifications@wheatandstone.ca",
    notificationPushVapidPublicKey: readTrimmedEnv("NOTIFICATION_PUSH_VAPID_PUBLIC_KEY"),
    notificationPushVapidPrivateKey: readTrimmedEnv("NOTIFICATION_PUSH_VAPID_PRIVATE_KEY"),
  };

  return validateEnv(env);
}
