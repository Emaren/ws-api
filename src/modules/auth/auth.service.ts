import { randomBytes } from "node:crypto";
import { HttpError } from "../../shared/http-error.js";
import type {
  PublicAuthSession,
  PublicUser,
  UserRole,
} from "../../shared/models.js";
import { toPublicAuthSession, toPublicUser } from "../../shared/models.js";
import { hashPassword, verifyPassword } from "../../shared/password.js";
import type { AuthRepository } from "./auth.repository.js";

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

interface LoginInput {
  email: string;
  password: string;
}

interface SessionPrincipal {
  user: PublicUser;
  session: PublicAuthSession;
}

export interface AuthLoginResult extends SessionPrincipal {
  accessToken: string;
}

export interface AuthSessionResult extends SessionPrincipal {}

interface AuthServiceOptions {
  sessionTtlSeconds: number;
}

function toDate(value: string): Date {
  return new Date(value);
}

function isExpired(expiresAt: string): boolean {
  return toDate(expiresAt).getTime() <= Date.now();
}

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly options: AuthServiceOptions,
  ) {}

  register(input: RegisterInput): PublicUser {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password.trim()) {
      throw new HttpError(400, "Missing email or password");
    }

    const existing = this.authRepository.findByEmail(email);
    if (existing) {
      throw new HttpError(409, "User already exists");
    }

    const user = this.authRepository.createUser({
      email,
      passwordHash: hashPassword(input.password),
      name: input.name.trim() || email.split("@")[0] || "user",
      role: input.role,
    });

    return toPublicUser(user);
  }

  login(input: LoginInput): AuthLoginResult {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password.trim()) {
      throw new HttpError(400, "Missing email or password");
    }

    const user = this.authRepository.findByEmail(email);
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new HttpError(401, "Invalid credentials");
    }

    const accessToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.options.sessionTtlSeconds * 1000).toISOString();

    const session = this.authRepository.createSession({
      userId: user.id,
      accessToken,
      expiresAt,
    });

    return {
      user: toPublicUser(user),
      session: toPublicAuthSession(session),
      accessToken,
    };
  }

  logout(accessToken: string): { message: string } {
    const token = accessToken.trim();
    if (!token) {
      throw new HttpError(401, "Missing bearer token");
    }

    const session = this.authRepository.revokeSessionByAccessToken(token);
    if (!session) {
      throw new HttpError(401, "Invalid session token");
    }

    return { message: "Logged out" };
  }

  getMe(accessToken: string): { user: PublicUser } {
    const principal = this.resolvePrincipal(accessToken);
    return { user: principal.user };
  }

  getSession(accessToken: string): AuthSessionResult {
    return this.resolvePrincipal(accessToken);
  }

  private resolvePrincipal(accessToken: string): SessionPrincipal {
    const token = accessToken.trim();
    if (!token) {
      throw new HttpError(401, "Missing bearer token");
    }

    const session = this.authRepository.findSessionByAccessToken(token);
    if (!session) {
      throw new HttpError(401, "Invalid session token");
    }

    if (session.revokedAt) {
      throw new HttpError(401, "Session revoked");
    }

    if (isExpired(session.expiresAt)) {
      this.authRepository.revokeSessionByAccessToken(token);
      throw new HttpError(401, "Session expired");
    }

    const user = this.authRepository.findById(session.userId);
    if (!user) {
      throw new HttpError(401, "Session user not found");
    }

    const touched = this.authRepository.touchSession(session.id);

    return {
      user: toPublicUser(user),
      session: toPublicAuthSession(touched ?? session),
    };
  }
}
