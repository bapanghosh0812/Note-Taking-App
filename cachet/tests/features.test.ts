import { describe, expect, it } from "vitest";
import { insertBlock, prefixLines, stats, wrap } from "@/components/editor/markdown-format";
import { DEFAULT_PREFERENCES, resolvePreferences } from "@/lib/preferences";
import { base32Decode, base32Encode, generateBackupCodes, generateTotpSecret, hotp, totp, verifyTotp } from "@/server/lib/totp";

// RFC 6238 appendix B uses the ASCII secret "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (RFC 6238 / RFC 4226)", () => {
  it("matches the RFC 4226 HOTP test vectors", () => {
    // Appendix D values, truncated to 6 digits.
    expect(hotp(RFC_SECRET, 0)).toBe("755224");
    expect(hotp(RFC_SECRET, 1)).toBe("287082");
    expect(hotp(RFC_SECRET, 9)).toBe("520489");
  });

  it("matches the RFC 6238 SHA-1 vectors (last 6 digits)", () => {
    expect(totp(RFC_SECRET, 59_000)).toBe("287082");
    expect(totp(RFC_SECRET, 1_111_111_109_000)).toBe("081804");
    expect(totp(RFC_SECRET, 1_234_567_890_000)).toBe("005924");
  });

  it("accepts the previous and next 30-second window but not older codes", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totp(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now + 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 90_000), now)).toBe(false);
  });

  it("rejects malformed codes", () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, "12345")).toBe(false);
    expect(verifyTotp(secret, "abcdef")).toBe(false);
  });

  it("round-trips base32 and makes 160-bit secrets", () => {
    const secret = generateTotpSecret();
    expect(base32Decode(secret)).toHaveLength(20);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it("creates ten distinct backup codes", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });
});

describe("editor formatting", () => {
  it("wraps a selection and toggles it off again", () => {
    const bold = wrap({ value: "make me bold", start: 8, end: 12 }, "**");
    expect(bold.value).toBe("make me **bold**");
    const unbold = wrap({ value: bold.value, start: bold.start, end: bold.end }, "**");
    expect(unbold.value).toBe("make me bold");
  });

  it("inserts a placeholder when nothing is selected", () => {
    const edit = wrap({ value: "", start: 0, end: 0 }, "_", "_", "italic");
    expect(edit.value).toBe("_italic_");
    expect(edit.value.slice(edit.start, edit.end)).toBe("italic");
  });

  it("prefixes every selected line and numbers ordered lists", () => {
    const text = "one\ntwo\nthree";
    expect(prefixLines({ value: text, start: 0, end: text.length }, "- ").value).toBe("- one\n- two\n- three");
    expect(prefixLines({ value: text, start: 0, end: text.length }, (i) => `${i + 1}. `).value).toBe("1. one\n2. two\n3. three");
  });

  it("puts blocks on their own paragraph", () => {
    expect(insertBlock({ value: "text", start: 4, end: 4 }, "---").value).toBe("text\n\n---\n");
  });

  it("counts words and reading time", () => {
    expect(stats("")).toEqual({ words: 0, chars: 0, minutes: 1 });
    expect(stats("one two  three").words).toBe(3);
  });
});

describe("preferences", () => {
  it("fills missing keys with defaults", () => {
    expect(resolvePreferences({})).toEqual(DEFAULT_PREFERENCES);
    expect(resolvePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps valid stored values and drops invalid ones", () => {
    const prefs = resolvePreferences({ accent: "rose", fontScale: "huge", autosave: false, unknownKey: 1 });
    expect(prefs.accent).toBe("rose");
    expect(prefs.fontScale).toBe(DEFAULT_PREFERENCES.fontScale);
    expect(prefs.autosave).toBe(false);
    expect(prefs).not.toHaveProperty("unknownKey");
  });
});
