import { describe, expect, it } from "vitest";
import { linkStatus } from "@/server/services/share";
import { safeRedirect } from "@/lib/safe-redirect";
import { scanForSensitiveData } from "@/lib/sensitive";
import { createNoteSchema } from "@/lib/validation";

const now = new Date("2026-01-01T12:00:00Z");
const later = new Date("2026-01-01T13:00:00Z");
const earlier = new Date("2026-01-01T11:00:00Z");
const base = { revokedAt: null, consumedAt: null, expiresAt: later, lockedUntil: null };

describe("linkStatus", () => {
  it("is active before expiry", () => expect(linkStatus(base, now)).toBe("active"));
  it("expires exactly at the expiry instant", () => expect(linkStatus({ ...base, expiresAt: now }, now)).toBe("expired"));
  it("reports a consumed one-time link as used", () => expect(linkStatus({ ...base, consumedAt: earlier }, now)).toBe("used"));
  it("lets an explicit revoke win over everything", () =>
    expect(linkStatus({ ...base, revokedAt: earlier, consumedAt: earlier, expiresAt: earlier }, now)).toBe("revoked"));
  it("reports a temporary lock", () => expect(linkStatus({ ...base, lockedUntil: later }, now)).toBe("locked"));
  it("ignores a lock that has already ended", () => expect(linkStatus({ ...base, lockedUntil: earlier }, now)).toBe("active"));
});

describe("createNoteSchema", () => {
  const valid = {
    title: "Hello",
    content: "World",
    share: { shareType: "one_time", accessType: "password", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
  };

  it("accepts a valid note", () => expect(createNoteSchema.safeParse(valid).success).toBe(true));
  it("rejects an expiry in the past", () =>
    expect(createNoteSchema.safeParse({ ...valid, share: { ...valid.share, expiresAt: "2020-01-01T00:00:00Z" } }).success).toBe(false));
  it("rejects an expiry more than a year away", () =>
    expect(
      createNoteSchema.safeParse({ ...valid, share: { ...valid.share, expiresAt: new Date(Date.now() + 400 * 86_400_000).toISOString() } })
        .success,
    ).toBe(false));
  it("rejects unknown share types", () =>
    expect(createNoteSchema.safeParse({ ...valid, share: { ...valid.share, shareType: "forever" } }).success).toBe(false));
  it("rejects whitespace-only content", () => expect(createNoteSchema.safeParse({ ...valid, content: "   " }).success).toBe(false));
});

describe("safeRedirect", () => {
  it("keeps same-site paths", () => expect(safeRedirect("/notes/123")).toBe("/notes/123"));
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", null])("blocks %s", (target) =>
    expect(safeRedirect(target)).toBe("/dashboard"),
  );
});

describe("security advisor", () => {
  it("flags passwords and API keys as high risk", () => {
    const findings = scanForSensitiveData("db password: hunter2\nkey sk-ant-abcdefghijklmnopqrstuvwxyz");
    expect(findings.map((f) => f.label)).toEqual(expect.arrayContaining(["Password", "API key or token"]));
    expect(findings.every((f) => f.severity === "high")).toBe(true);
  });
  it("detects valid card numbers only (Luhn)", () => {
    expect(scanForSensitiveData("4111 1111 1111 1111").map((f) => f.label)).toContain("Card number");
    expect(scanForSensitiveData("4111 1111 1111 1112").map((f) => f.label)).not.toContain("Card number");
  });
  it("stays quiet on ordinary notes", () => expect(scanForSensitiveData("Buy milk and call mom")).toEqual([]));
});
