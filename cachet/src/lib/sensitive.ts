/**
 * Local "security advisor": spots secrets and personal data in a note so the
 * UI can recommend safer share settings. Runs entirely in the browser — the
 * note is never sent anywhere for this check.
 */

export type Finding = { label: string; severity: "high" | "medium" };

const PATTERNS: { label: string; severity: Finding["severity"]; test: (text: string) => boolean }[] = [
  { label: "Private key", severity: "high", test: (t) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(t) },
  {
    label: "API key or token",
    severity: "high",
    test: (t) =>
      /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/.test(t) ||
      /\bsk-[A-Za-z0-9_-]{20,}\b/.test(t) ||
      /\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(t) ||
      /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/.test(t) ||
      /\bAKIA[0-9A-Z]{16}\b/.test(t) ||
      /\bAIza[0-9A-Za-z_-]{35}\b/.test(t),
  },
  { label: "JSON Web Token", severity: "high", test: (t) => /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(t) },
  { label: "Password", severity: "high", test: (t) => /\b(?:password|passwd|pwd|passcode|pin|otp)\s*[:=]\s*\S{3,}/i.test(t) },
  { label: "Card number", severity: "high", test: hasCardNumber },
  { label: "Aadhaar number", severity: "high", test: (t) => /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/.test(t) },
  { label: "PAN number", severity: "medium", test: (t) => /\b[A-Z]{5}\d{4}[A-Z]\b/.test(t) },
  { label: "Bank details", severity: "medium", test: (t) => /\b(?:IFSC|IBAN|account\s*(?:no|number))\b/i.test(t) },
  { label: "Phone number", severity: "medium", test: (t) => /(?:\+?\d{1,3}[ -]?)?\b[6-9]\d{9}\b/.test(t) },
  { label: "Email address", severity: "medium", test: (t) => /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/.test(t) },
];

function luhn(digits: string) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function hasCardNumber(text: string) {
  const candidates = text.match(/\b(?:\d[ -]?){13,19}\b/g) ?? [];
  return candidates.some((c) => {
    const digits = c.replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 19 && luhn(digits);
  });
}

export function scanForSensitiveData(text: string): Finding[] {
  if (!text.trim()) return [];
  return PATTERNS.filter((p) => p.test(text)).map(({ label, severity }) => ({ label, severity }));
}
