import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

/**
 * Short-lived, signed "login ticket" handed out after a correct password when
 * the account has 2FA on. It proves step 1 passed without creating a session;
 * step 2 (the 6-digit code) must present it before it expires.
 * Format: base64url(payload).base64url(HMAC-SHA256(payload))
 */
const TTL_MS = 5 * 60 * 1000;

function sign(payload: string) {
  return createHmac("sha256", `cachet:2fa-ticket:${env().APP_SECRET}`).update(payload).digest("base64url");
}

export function issueTicket(userId: string) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readTicket(ticket: string): string | null {
  const [payload, signature] = ticket.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid: string; exp: number };
    return typeof uid === "string" && typeof exp === "number" && exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
}
