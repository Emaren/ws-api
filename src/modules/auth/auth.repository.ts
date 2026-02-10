import type { UserRecord } from "../../shared/models.js";
import type { CreateUserParams, UsersRepository } from "../users/users.repository.js";

export interface AuthRepository {
  findByEmail(email: string): UserRecord | undefined;
  createUser(params: CreateUserParams): UserRecord;
}

export class AuthRepositoryAdapter implements AuthRepository {
  constructor(private readonly usersRepository: UsersRepository) {}

  findByEmail(email: string): UserRecord | undefined {
    return this.usersRepository.findByEmail(email);
  }

  createUser(params: CreateUserParams): UserRecord {
    return this.usersRepository.create(params);
  }
}
