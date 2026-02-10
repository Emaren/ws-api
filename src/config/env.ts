import dotenv from "dotenv";

dotenv.config();

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

function parseOrigins(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export interface AppEnv {
  serviceName: string;
  port: number;
  corsOrigins: string[];
  bootstrapAdminEmail: string | undefined;
  bootstrapAdminPassword: string | undefined;
  bootstrapAdminName: string;
}

export function loadEnv(): AppEnv {
  return {
    serviceName: readTrimmedEnv("SERVICE_NAME") ?? "ws-api",
    port: parsePort(readTrimmedEnv("PORT")),
    corsOrigins: parseOrigins(readTrimmedEnv("CORS_ORIGINS")),
    bootstrapAdminEmail: readTrimmedEnv("BOOTSTRAP_ADMIN_EMAIL"),
    bootstrapAdminPassword: readTrimmedEnv("BOOTSTRAP_ADMIN_PASSWORD"),
    bootstrapAdminName: readTrimmedEnv("BOOTSTRAP_ADMIN_NAME") ?? "Owner",
  };
}
