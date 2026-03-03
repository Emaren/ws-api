import type { MemoryStore } from "../../infrastructure/memory/memory-store.js";
import { createId, nowIso } from "../../shared/ids.js";
import type { AuthSessionRecord, UserRecord } from "../../shared/models.js";
import type { CreateUserParams, UsersRepository } from "../users/users.repository.js";

export interface CreateSessionParams {
  userId: string;
  accessToken: string;
  expiresAt: string;
}

export interface AuthRepository {
  findById(userId: string): Promise<UserRecord | undefined>;
  findByEmail(email: string): Promise<UserRecord | undefined>;
  createUser(params: CreateUserParams): Promise<UserRecord>;
  createSession(params: CreateSessionParams): Promise<AuthSessionRecord>;
  findSessionByAccessToken(accessToken: string): Promise<AuthSessionRecord | undefined>;
  touchSession(sessionId: string): Promise<AuthSessionRecord | undefined>;
  revokeSessionByAccessToken(accessToken: string): Promise<AuthSessionRecord | undefined>;
  revokeAllSessionsForUser(userId: string): Promise<number>;
}

export class AuthRepositoryAdapter implements AuthRepository {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly store: MemoryStore,
  ) {}

  async findById(userId: string): Promise<UserRecord | undefined> {
    return this.usersRepository.findById(userId);
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    return this.usersRepository.findByEmail(email);
  }

  async createUser(params: CreateUserParams): Promise<UserRecord> {
    return this.usersRepository.create(params);
  }

  async createSession(params: CreateSessionParams): Promise<AuthSessionRecord> {
    const timestamp = nowIso();
    const session: AuthSessionRecord = {
      id: createId("sess"),
      userId: params.userId,
      accessToken: params.accessToken,
      issuedAt: timestamp,
      expiresAt: params.expiresAt,
      lastSeenAt: timestamp,
      revokedAt: null,
    };

    this.store.authSessions.push(session);
    return session;
  }

  async findSessionByAccessToken(accessToken: string): Promise<AuthSessionRecord | undefined> {
    return this.store.authSessions.find((session) => session.accessToken === accessToken);
  }

  async touchSession(sessionId: string): Promise<AuthSessionRecord | undefined> {
    const session = this.store.authSessions.find((candidate) => candidate.id === sessionId);
    if (!session) {
      return undefined;
    }

    session.lastSeenAt = nowIso();
    return session;
  }

  async revokeSessionByAccessToken(accessToken: string): Promise<AuthSessionRecord | undefined> {
    const session = await this.findSessionByAccessToken(accessToken);
    if (!session) {
      return undefined;
    }

    if (!session.revokedAt) {
      session.revokedAt = nowIso();
      session.lastSeenAt = session.revokedAt;
    }

    return session;
  }

  async revokeAllSessionsForUser(userId: string): Promise<number> {
    let revokedCount = 0;

    for (const session of this.store.authSessions) {
      if (session.userId !== userId || session.revokedAt) {
        continue;
      }

      session.revokedAt = nowIso();
      session.lastSeenAt = session.revokedAt;
      revokedCount += 1;
    }

    return revokedCount;
  }
}
