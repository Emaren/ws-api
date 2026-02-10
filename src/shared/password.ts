import { createHash, timingSafeEqual } from "node:crypto";

const SCHEME = "sha256";

function digestPassword(password: string): Buffer {
  return createHash("sha256").update(password, "utf8").digest();
}

export function hashPassword(password: string): string {
  const hex = digestPassword(password).toString("hex");
  return `${SCHEME}:${hex}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash.startsWith(`${SCHEME}:`)) {
    return false;
  }

  const expectedHex = storedHash.slice(`${SCHEME}:`.length);
  if (expectedHex.length !== 64) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedHex, "hex");
  const candidateBuffer = digestPassword(password);
  return timingSafeEqual(candidateBuffer, expectedBuffer);
}
