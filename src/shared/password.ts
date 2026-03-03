import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const LEGACY_SCHEME = "sha256";
const BCRYPT_HASH_PREFIX = /^\$2[aby]\$/;
const BCRYPT_SALT_ROUNDS = 10;

function digestPassword(password: string): Buffer {
  return createHash("sha256").update(password, "utf8").digest();
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const hash = storedHash.trim();
  if (!hash) {
    return false;
  }

  if (BCRYPT_HASH_PREFIX.test(hash)) {
    return bcrypt.compareSync(password, hash);
  }

  if (!hash.startsWith(`${LEGACY_SCHEME}:`)) {
    return false;
  }

  const expectedHex = hash.slice(`${LEGACY_SCHEME}:`.length);
  if (expectedHex.length !== 64) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedHex, "hex");
  const candidateBuffer = digestPassword(password);
  return timingSafeEqual(candidateBuffer, expectedBuffer);
}
