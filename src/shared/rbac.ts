import type { UserRole } from "./models.js";

const LEGACY_ROLE_ALIASES: Record<string, UserRole> = {
  STONEHOLDER: "USER",
};

export const RBAC_ROLE_ORDER = [
  "USER",
  "CONTRIBUTOR",
  "EDITOR",
  "ADMIN",
  "OWNER",
] as const satisfies ReadonlyArray<UserRole>;

export const RBAC_ROLES = {
  ownerAdmin: ["OWNER", "ADMIN"] as const,
  editorial: ["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR"] as const,
  staff: ["OWNER", "ADMIN", "EDITOR"] as const,
  authenticated: ["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR", "USER"] as const,
} as const;

export function normalizeRole(input: string | null | undefined): UserRole | undefined {
  if (!input) {
    return undefined;
  }

  const upper = input.trim().toUpperCase();
  if (!upper) {
    return undefined;
  }

  const mapped = LEGACY_ROLE_ALIASES[upper] ?? upper;
  if (RBAC_ROLE_ORDER.includes(mapped as UserRole)) {
    return mapped as UserRole;
  }

  return undefined;
}

export function hasAnyRole(
  role: UserRole | undefined,
  allowedRoles: readonly UserRole[],
): boolean {
  if (!role) {
    return false;
  }

  return allowedRoles.includes(role);
}
