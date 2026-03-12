import assert from "node:assert/strict";
import { test } from "node:test";
import { PostgresUsersRepository } from "./modules/users/users.repository.js";

test("PostgresUsersRepository.create writes createdAt and updatedAt on insert", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];

  const pool = {
    async query<T>(sql: string, params: unknown[]) {
      calls.push({ sql, params });
      return {
        rows: [
          {
            id: "usr_test",
            email: "person@example.com",
            password: "hashed",
            name: "Person",
            role: "USER",
            createdAt: new Date("2026-03-12T23:00:00.000Z"),
            updatedAt: new Date("2026-03-12T23:00:00.000Z"),
          },
        ] as T[],
      };
    },
  };

  const repository = new PostgresUsersRepository(pool as never);
  const user = await repository.create({
    email: "person@example.com",
    passwordHash: "hashed",
    name: "Person",
    role: "USER",
  });

  assert.equal(user.email, "person@example.com");
  assert.equal(calls.length, 1);
  assert.match(
    calls[0]?.sql ?? "",
    /INSERT INTO "User" \(id, email, password, name, role, "createdAt", "updatedAt"\)/,
  );
  assert.equal(calls[0]?.params.length, 6);
  assert.ok(calls[0]?.params[5] instanceof Date);
});
