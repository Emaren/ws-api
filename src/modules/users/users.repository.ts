import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type { UserRecord, UserRole } from "../../shared/models.js";
import { normalizeRole } from "../../shared/rbac.js";
import type { Pool } from "pg";

export interface CreateUserParams {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
}

export interface UsersRepository {
  list(): Promise<UserRecord[]>;
  findById(id: string): Promise<UserRecord | undefined>;
  findByEmail(email: string): Promise<UserRecord | undefined>;
  create(params: CreateUserParams): Promise<UserRecord>;
  updateRole(id: string, role: UserRole): Promise<UserRecord | undefined>;
  updatePassword(id: string, passwordHash: string): Promise<UserRecord | undefined>;
}

export class InMemoryUsersRepository implements UsersRepository {
  constructor(private readonly store: MemoryStore) {}

  async list(): Promise<UserRecord[]> {
    return [...this.store.users];
  }

  async findById(id: string): Promise<UserRecord | undefined> {
    return this.store.users.find((user) => user.id === id);
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    return this.store.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  async create(params: CreateUserParams): Promise<UserRecord> {
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

  async updateRole(id: string, role: UserRole): Promise<UserRecord | undefined> {
    const user = await this.findById(id);
    if (!user) {
      return undefined;
    }

    user.role = role;
    user.updatedAt = nowIso();
    return user;
  }

  async updatePassword(id: string, passwordHash: string): Promise<UserRecord | undefined> {
    const user = await this.findById(id);
    if (!user) {
      return undefined;
    }

    user.passwordHash = passwordHash;
    user.updatedAt = nowIso();
    return user;
  }
}

type PostgresUserRow = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? nowIso() : date.toISOString();
}

function mapPostgresUser(row: PostgresUserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password,
    name: row.name,
    role: normalizeRole(row.role) ?? "USER",
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export class PostgresUsersRepository implements UsersRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<UserRecord[]> {
    const result = await this.pool.query<PostgresUserRow>(
      `SELECT id, email, password, name, role, "createdAt", "updatedAt"
       FROM "User"
       ORDER BY "createdAt" ASC`,
    );
    return result.rows.map(mapPostgresUser);
  }

  async findById(id: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query<PostgresUserRow>(
      `SELECT id, email, password, name, role, "createdAt", "updatedAt"
       FROM "User"
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapPostgresUser(row) : undefined;
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query<PostgresUserRow>(
      `SELECT id, email, password, name, role, "createdAt", "updatedAt"
       FROM "User"
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email],
    );
    const row = result.rows[0];
    return row ? mapPostgresUser(row) : undefined;
  }

  async create(params: CreateUserParams): Promise<UserRecord> {
    const result = await this.pool.query<PostgresUserRow>(
      `INSERT INTO "User" (id, email, password, name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, password, name, role, "createdAt", "updatedAt"`,
      [
        createId("usr"),
        params.email,
        params.passwordHash,
        params.name,
        params.role,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Failed to create user in Postgres repository");
    }
    return mapPostgresUser(row);
  }

  async updateRole(id: string, role: UserRole): Promise<UserRecord | undefined> {
    const result = await this.pool.query<PostgresUserRow>(
      `UPDATE "User"
       SET role = $2, "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, email, password, name, role, "createdAt", "updatedAt"`,
      [id, role],
    );
    const row = result.rows[0];
    return row ? mapPostgresUser(row) : undefined;
  }

  async updatePassword(id: string, passwordHash: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query<PostgresUserRow>(
      `UPDATE "User"
       SET password = $2, "updatedAt" = NOW()
       WHERE id = $1
       RETURNING id, email, password, name, role, "createdAt", "updatedAt"`,
      [id, passwordHash],
    );
    const row = result.rows[0];
    return row ? mapPostgresUser(row) : undefined;
  }
}
