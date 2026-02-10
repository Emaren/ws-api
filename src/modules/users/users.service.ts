import { HttpError } from "../../shared/http-error.js";
import type { PublicUser, UserRole } from "../../shared/models.js";
import { toPublicUser } from "../../shared/models.js";
import { normalizeRole } from "../../shared/rbac.js";
import type { UsersRepository } from "./users.repository.js";

const VALID_ROLES: UserRole[] = ["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR", "USER"];

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  listUsers(): PublicUser[] {
    return this.usersRepository.list().map(toPublicUser);
  }

  setRole(userId: string, role: string): PublicUser {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole || !VALID_ROLES.includes(normalizedRole)) {
      throw new HttpError(400, "Invalid role");
    }

    const updated = this.usersRepository.updateRole(userId, normalizedRole);
    if (!updated) {
      throw new HttpError(404, "User not found");
    }

    return toPublicUser(updated);
  }
}
