/**
 * M4: password hashing.
 *
 * New hashes use Node's built-in scrypt — native, no extra dependency, and
 * ~3-5x faster than bcryptjs at the same security level so Vercel serverless
 * functions don't burn 300ms per login. Old bcrypt hashes (from seeds / before
 * this migration) still validate via the compat branch in verifyPassword().
 *
 * Hash format: `scrypt$<saltHex>$<keyHex>`.
 */

import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import bcrypt from "bcryptjs";

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;

export async function hashPassword(plain: string) {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(plain, salt, KEY_BYTES);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string) {
  if (!stored.startsWith("scrypt$")) {
    // Legacy bcrypt hash — compare via bcryptjs (handles $2a$ / $2b$).
    return bcrypt.compare(plain, stored);
  }
  const [, saltHex, keyHex] = stored.split("$");
  if (!saltHex || !keyHex) return false;
  const target = Buffer.from(keyHex, "hex");
  const candidate = await scrypt(plain, Buffer.from(saltHex, "hex"), target.length);
  return target.length === candidate.length && timingSafeEqual(target, candidate);
}
