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

interface BridgePasswordResetInput {
  email: string;
  password: string;
  bridgeKey: string;
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
  bridgeSharedSecret?: string;
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

  async register(input: RegisterInput): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password.trim()) {
      throw new HttpError(400, "Missing email or password");
    }

    const existing = await this.authRepository.findByEmail(email);
    if (existing) {
      throw new HttpError(409, "User already exists");
    }

    const user = await this.authRepository.createUser({
      email,
      passwordHash: hashPassword(input.password),
      name: input.name.trim() || email.split("@")[0] || "user",
      role: input.role,
    });

    return toPublicUser(user);
  }

  async login(input: LoginInput): Promise<AuthLoginResult> {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password.trim()) {
      throw new HttpError(400, "Missing email or password");
    }

    const user = await this.authRepository.findByEmail(email);
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new HttpError(401, "Invalid credentials");
    }

    const accessToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.options.sessionTtlSeconds * 1000).toISOString();

    const session = await this.authRepository.createSession({
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

  async logout(accessToken: string): Promise<{ message: string }> {
    const token = accessToken.trim();
    if (!token) {
      throw new HttpError(401, "Missing bearer token");
    }

    const session = await this.authRepository.revokeSessionByAccessToken(token);
    if (!session) {
      throw new HttpError(401, "Invalid session token");
    }

    return { message: "Logged out" };
  }

  async getMe(accessToken: string): Promise<{ user: PublicUser }> {
    const principal = await this.resolvePrincipal(accessToken);
    return { user: principal.user };
  }

  async getSession(accessToken: string): Promise<AuthSessionResult> {
    return this.resolvePrincipal(accessToken);
  }

  async resetPasswordViaBridge(
    input: BridgePasswordResetInput,
  ): Promise<{ message: string; user: PublicUser }> {
    const configuredSecret = this.options.bridgeSharedSecret?.trim();
    if (!configuredSecret) {
      throw new HttpError(503, "Password bridge is not configured");
    }

    if (input.bridgeKey.trim() !== configuredSecret) {
      throw new HttpError(401, "Invalid bridge credentials");
    }

    const email = input.email.trim().toLowerCase();
    if (!email || !input.password.trim()) {
      throw new HttpError(400, "Missing email or password");
    }

    if (input.password.length < 8) {
      throw new HttpError(400, "Password must be at least 8 characters");
    }

    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      throw new HttpError(404, "User not found");
    }

    const passwordHash = hashPassword(input.password);
    const updatedUser = await this.authRepository.updateUserPassword(
      user.id,
      passwordHash,
    );
    if (!updatedUser) {
      throw new HttpError(500, "Failed to update password");
    }

    await this.authRepository.revokeAllSessionsForUser(updatedUser.id);

    return {
      message: "Password updated",
      user: toPublicUser(updatedUser),
    };
  }

  private async resolvePrincipal(accessToken: string): Promise<SessionPrincipal> {
    const token = accessToken.trim();
    if (!token) {
      throw new HttpError(401, "Missing bearer token");
    }

    const session = await this.authRepository.findSessionByAccessToken(token);
    if (!session) {
      throw new HttpError(401, "Invalid session token");
    }

    if (session.revokedAt) {
      throw new HttpError(401, "Session revoked");
    }

    if (isExpired(session.expiresAt)) {
      await this.authRepository.revokeSessionByAccessToken(token);
      throw new HttpError(401, "Session expired");
    }

    const user = await this.authRepository.findById(session.userId);
    if (!user) {
      throw new HttpError(401, "Session user not found");
    }

    const touched = await this.authRepository.touchSession(session.id);

    return {
      user: toPublicUser(user),
      session: toPublicAuthSession(touched ?? session),
    };
  }
}
