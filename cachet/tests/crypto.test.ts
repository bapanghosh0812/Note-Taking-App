import { describe, expect, it } from "vitest";
import { TOKEN_PATTERN, generateAccessKey, generateToken, normalizeAccessKey, sha256 } from "@/server/lib/crypto";
import { hashSecret, verifySecret } from "@/server/lib/scrypt";

describe("share tokens", () => {
  it("are 256-bit base64url strings", () => {
    const token = generateToken();
    expect(token).toMatch(TOKEN_PATTERN);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("never repeat", () => {
    const tokens = new Set(Array.from({ length: 5000 }, generateToken));
    expect(tokens.size).toBe(5000);
  });

  it("are stored as a stable sha256 fingerprint", () => {
    const token = generateToken();
    expect(sha256(token)).toBe(sha256(token));
    expect(sha256(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256(token)).not.toContain(token);
  });
});

describe("access keys", () => {
  it("use the XXXX-XXXX-XXXX format without ambiguous characters", () => {
    for (let i = 0; i < 500; i++) {
      const key = generateAccessKey();
      expect(key).toMatch(/^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
      expect(key).not.toMatch(/[01ILO]/);
    }
  });

  it("are unique across many generations", () => {
    const keys = new Set(Array.from({ length: 5000 }, generateAccessKey));
    expect(keys.size).toBe(5000);
  });

  it("are normalized regardless of case, spaces and dashes", () => {
    expect(normalizeAccessKey(" k7qm-3xhp rw9d ")).toBe("K7QM3XHPRW9D");
    expect(normalizeAccessKey("K7QM3XHPRW9D")).toBe("K7QM3XHPRW9D");
  });
});

describe("scrypt hashing", () => {
  it("verifies the right secret and rejects a wrong one", async () => {
    const hash = await hashSecret("K7QM3XHPRW9D");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifySecret("K7QM3XHPRW9D", hash)).toBe(true);
    expect(await verifySecret("K7QM3XHPRW9E", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    const [a, b] = await Promise.all([hashSecret("same"), hashSecret("same")]);
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifySecret("x", "not-a-hash")).toBe(false);
    expect(await verifySecret("x", "bcrypt$1$2$3$4$5")).toBe(false);
  });
});
