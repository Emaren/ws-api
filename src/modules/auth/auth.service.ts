import { HttpError } from "../../shared/http-error.js";
import type { PublicUser, UserRole } from "../../shared/models.js";
import { toPublicUser } from "../../shared/models.js";
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

export interface AuthLoginResult {
  user: PublicUser;
  accessToken: string;
}

export class AuthService {
  constructor(private readonly authRepository: AuthRepository) {}

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

    return {
      user: toPublicUser(user),
      accessToken: Buffer.from(`${user.id}:${Date.now()}`).toString("base64url"),
    };
  }
}
