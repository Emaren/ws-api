import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (typeof result.status !== "number") {
    throw new Error(`Unable to run command: ${command} ${args.join(" ")}`);
  }

  if (result.status !== 0) {
    process.exit(result.status);
  }
}

function hasMeaningfulPrismaMigrations() {
  if (!existsSync("prisma/migrations")) {
    return false;
  }

  try {
    const entries = readdirSync("prisma/migrations", {
      withFileTypes: true,
    }).filter((entry) => !entry.name.startsWith("."));

    if (entries.length === 0) {
      return false;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (existsSync(`prisma/migrations/${entry.name}/migration.sql`)) {
          return true;
        }
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".sql")) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

const hasPrismaSchema = existsSync("prisma/schema.prisma");
const hasPrismaMigrations = hasMeaningfulPrismaMigrations();

if (!hasPrismaSchema && !hasPrismaMigrations) {
  console.log("[ci:migrations] no migration framework detected; passing as no-op.");
  process.exit(0);
}

if (!hasPrismaSchema) {
  console.error(
    "[ci:migrations] prisma/migrations exists but prisma/schema.prisma is missing.",
  );
  process.exit(1);
}

console.log("[ci:migrations] Prisma schema detected; running validation...");
run("npx", ["prisma", "validate"]);

if (hasPrismaMigrations) {
  console.log("[ci:migrations] Prisma migrations detected; running status check...");
  run("npx", ["prisma", "migrate", "status"]);
} else {
  console.log("[ci:migrations] prisma/migrations not found; validation-only pass.");
}
