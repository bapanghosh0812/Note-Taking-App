import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../env";

/**
 * AES-256-GCM for small secrets we must be able to read back (the TOTP seed).
 * Unlike passwords, a TOTP secret can't be hashed — the server needs it to
 * compute the expected code. GCM also authenticates, so tampering is detected.
 * Format: base64(iv[12] | tag[16] | ciphertext)
 */
function key() {
  return createHash("sha256").update(`cachet:secret-box:${env().APP_SECRET}`).digest();
}

export function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function open(sealed: string): string {
  const raw = Buffer.from(sealed, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
