import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type { UserRecord, UserRole } from "../../shared/models.js";

export interface CreateUserParams {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
}

export interface UsersRepository {
  list(): UserRecord[];
  findById(id: string): UserRecord | undefined;
  findByEmail(email: string): UserRecord | undefined;
  create(params: CreateUserParams): UserRecord;
  updateRole(id: string, role: UserRole): UserRecord | undefined;
}

export class InMemoryUsersRepository implements UsersRepository {
  constructor(private readonly store: MemoryStore) {}

  list(): UserRecord[] {
    return [...this.store.users];
  }

  findById(id: string): UserRecord | undefined {
    return this.store.users.find((user) => user.id === id);
  }

  findByEmail(email: string): UserRecord | undefined {
    return this.store.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  create(params: CreateUserParams): UserRecord {
    const timestamp = nowIso();
    const user: UserRecord = {
      id: createId("usr"),
      email: params.email,
      passwordHash: params.passwordHash,
      name: params.name,
      role: params.role,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.store.users.push(user);
    return user;
  }

  updateRole(id: string, role: UserRole): UserRecord | undefined {
    const user = this.findById(id);
    if (!user) {
      return undefined;
    }

    user.role = role;
    user.updatedAt = nowIso();
    return user;
  }
}
