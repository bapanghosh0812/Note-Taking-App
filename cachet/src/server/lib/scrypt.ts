import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Kept free of "server-only" so CLI scripts (seed) can reuse it. It imports
// node:crypto, so it can never end up in a browser bundle anyway.

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );

/* Slow hashing for user passwords and link access keys. */

// scrypt is memory-hard (≈32 MiB per hash here), which makes GPU cracking expensive.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 } as const;

export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(secret.normalize("NFKC"), salt, SCRYPT.keylen, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(secret.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  // Constant-time comparison: response time does not reveal how many bytes matched.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

