import dotenv from "dotenv";
import type { LogLevel } from "../shared/logger.js";

dotenv.config();

type NodeEnv = "development" | "test" | "production";

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

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export interface AppEnv {
  nodeEnv: NodeEnv;
  serviceName: string;
  port: number;
  logLevel: LogLevel;
  corsOrigins: string[];
  allowWildcardCorsInProduction: boolean;
  authSessionTtlSeconds: number;
  bootstrapAdminEmail: string | undefined;
  bootstrapAdminPassword: string | undefined;
  bootstrapAdminName: string;
}

function validateEnv(env: AppEnv): AppEnv {
  if (!env.serviceName.trim()) {
    throw new Error("SERVICE_NAME must be non-empty");
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

  return env;
}

export function loadEnv(): AppEnv {
  const env: AppEnv = {
    nodeEnv: parseNodeEnv(readTrimmedEnv("NODE_ENV")),
    serviceName: readTrimmedEnv("SERVICE_NAME") ?? "ws-api",
    port: parsePort(readTrimmedEnv("PORT")),
    logLevel: parseLogLevel(readTrimmedEnv("LOG_LEVEL")),
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
  };

  return validateEnv(env);
}
