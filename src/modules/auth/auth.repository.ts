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
  findById(userId: string): UserRecord | undefined;
  findByEmail(email: string): UserRecord | undefined;
  createUser(params: CreateUserParams): UserRecord;
  createSession(params: CreateSessionParams): AuthSessionRecord;
  findSessionByAccessToken(accessToken: string): AuthSessionRecord | undefined;
  touchSession(sessionId: string): AuthSessionRecord | undefined;
  revokeSessionByAccessToken(accessToken: string): AuthSessionRecord | undefined;
  revokeAllSessionsForUser(userId: string): number;
}

export class AuthRepositoryAdapter implements AuthRepository {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly store: MemoryStore,
  ) {}

  findById(userId: string): UserRecord | undefined {
    return this.usersRepository.findById(userId);
  }

  findByEmail(email: string): UserRecord | undefined {
    return this.usersRepository.findByEmail(email);
  }

  createUser(params: CreateUserParams): UserRecord {
    return this.usersRepository.create(params);
  }

  createSession(params: CreateSessionParams): AuthSessionRecord {
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

  findSessionByAccessToken(accessToken: string): AuthSessionRecord | undefined {
    return this.store.authSessions.find((session) => session.accessToken === accessToken);
  }

  touchSession(sessionId: string): AuthSessionRecord | undefined {
    const session = this.store.authSessions.find((candidate) => candidate.id === sessionId);
    if (!session) {
      return undefined;
    }

    session.lastSeenAt = nowIso();
    return session;
  }

  revokeSessionByAccessToken(accessToken: string): AuthSessionRecord | undefined {
    const session = this.findSessionByAccessToken(accessToken);
    if (!session) {
      return undefined;
    }

    if (!session.revokedAt) {
      session.revokedAt = nowIso();
      session.lastSeenAt = session.revokedAt;
    }

    return session;
  }

  revokeAllSessionsForUser(userId: string): number {
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
