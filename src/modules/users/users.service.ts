import { HttpError } from "../../shared/http-error.js";
import type { PublicUser, UserRole } from "../../shared/models.js";
import { toPublicUser } from "../../shared/models.js";
import type { UsersRepository } from "./users.repository.js";

const VALID_ROLES: UserRole[] = ["OWNER", "ADMIN", "CONTRIBUTOR", "STONEHOLDER"];

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  listUsers(): PublicUser[] {
    return this.usersRepository.list().map(toPublicUser);
  }

  setRole(userId: string, role: string): PublicUser {
    if (!VALID_ROLES.includes(role as UserRole)) {
      throw new HttpError(400, "Invalid role");
    }

    const updated = this.usersRepository.updateRole(userId, role as UserRole);
    if (!updated) {
      throw new HttpError(404, "User not found");
    }

    return toPublicUser(updated);
  }
}
