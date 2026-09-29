import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Time-based one-time passwords (RFC 6238) — the 6-digit codes shown by
 * Google Authenticator, Microsoft Authenticator, 1Password, etc.
 * Implemented with node:crypto only, so every step can be explained.
 */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    value = (value << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit secret, the size recommended by RFC 4226. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP (RFC 4226): HMAC-SHA1 over the counter, then "dynamic truncation" to 6 digits. */
export function hotp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(code).padStart(DIGITS, "0");
}

export function totp(secret: string, at = Date.now()): string {
  return hotp(secret, Math.floor(at / 1000 / STEP_SECONDS));
}

/**
 * Accepts the current code and the ones directly before/after it (±30 s) to
 * tolerate clock drift between the phone and the server.
 */
export function verifyTotp(secret: string, code: string, at = Date.now()): boolean {
  const input = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(input)) return false;
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  let ok = false;
  for (const drift of [-1, 0, 1]) {
    const expected = Buffer.from(hotp(secret, counter + drift));
    // Check every window (no early return) and compare in constant time.
    if (timingSafeEqual(expected, Buffer.from(input))) ok = true;
  }
  return ok;
}

export function otpauthUri(secret: string, account: string, issuer = "Cachet") {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Ten single-use recovery codes like `7F3K-9QX2`. */
export function generateBackupCodes(count = 10): string[] {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: count }, () => {
    const chars = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}
