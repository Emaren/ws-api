export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeLevel(value: string | undefined): LogLevel {
  if (!value) {
    return "info";
  }

  const lower = value.toLowerCase();
  if (lower === "debug" || lower === "info" || lower === "warn" || lower === "error") {
    return lower;
  }

  return "info";
}

export function shouldLog(level: LogLevel, configuredLevel: string | undefined): boolean {
  const current = normalizeLevel(configuredLevel);
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[current];
}

export function logEvent(
  level: LogLevel,
  configuredLevel: string | undefined,
  event: string,
  fields: Record<string, unknown>,
): void {
  if (!shouldLog(level, configuredLevel)) {
    return;
  }

  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}
