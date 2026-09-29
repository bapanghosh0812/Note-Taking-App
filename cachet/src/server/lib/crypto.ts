import "server-only";
import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import { env } from "../env";
import { hashSecret } from "./scrypt";

/* ------------------------------------------------------------------ */
/* Random tokens                                                      */
/* ------------------------------------------------------------------ */

/** 256-bit URL-safe random token (43 chars). Used for share links and sessions. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Tokens are high-entropy, so a fast hash is enough to make a stolen
 * database useless for building valid links (no need for a slow KDF).
 */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Keyed hash for values we want to correlate but never store raw (IP addresses). */
export function hmac(value: string): string {
  return createHmac("sha256", env().APP_SECRET).update(value).digest("hex").slice(0, 32);
}

/* ------------------------------------------------------------------ */
/* Access keys for password-protected links                           */
/* ------------------------------------------------------------------ */

// No 0/O, 1/I/L — easy to read aloud and type from a phone.
const KEY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const KEY_GROUPS = 3;
const KEY_GROUP_SIZE = 4;

/**
 * Generates a key like `K7QM-3XHP-RW9D`.
 * 12 chars from a 31-char alphabet ≈ 59 bits of entropy. `randomInt` draws
 * uniformly from the CSPRNG, so there is no modulo bias.
 */
export function generateAccessKey(): string {
  const groups: string[] = [];
  for (let g = 0; g < KEY_GROUPS; g++) {
    let group = "";
    for (let i = 0; i < KEY_GROUP_SIZE; i++) {
      group += KEY_ALPHABET[randomInt(KEY_ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

/** Accept the key in any case, with or without dashes/spaces. */
export function normalizeAccessKey(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export { hashSecret, verifySecret } from "./scrypt";

// Pre-computed hash of a random value. Verifying against it when an email does
// not exist keeps login timing identical for real and unknown accounts.
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashSecret(generateToken());
  return dummyHash;
}
