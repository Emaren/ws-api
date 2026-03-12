import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface ServiceReleaseInfo {
  packageName: string;
  packageVersion: string;
  gitShaShort: string | null;
  gitBranch: string | null;
  nodeVersion: string;
  startedAt: string;
  metadataSource: "runtime";
}

function safeGit(cmd: string): string | null {
  try {
    const value = execSync(cmd, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();

    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function resolveServiceReleaseInfo(startedAtMs: number): ServiceReleaseInfo {
  let packageName = "ws-api";
  let packageVersion = "0.0.0";

  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8");
    const parsed = JSON.parse(raw) as {
      name?: unknown;
      version?: unknown;
    };

    if (typeof parsed.name === "string" && parsed.name.trim().length > 0) {
      packageName = parsed.name.trim();
    }
    if (typeof parsed.version === "string" && parsed.version.trim().length > 0) {
      packageVersion = parsed.version.trim();
    }
  } catch {
    // Fallbacks above are sufficient for health output.
  }

  return {
    packageName,
    packageVersion,
    gitShaShort: safeGit("git rev-parse --short HEAD"),
    gitBranch: safeGit("git rev-parse --abbrev-ref HEAD"),
    nodeVersion: process.version,
    startedAt: new Date(startedAtMs).toISOString(),
    metadataSource: "runtime",
  };
}
