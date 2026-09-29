import "server-only";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { getDb } from "../db";
import { notifications, securityEvents, users } from "../db/schema";
import { clientIpHash, userAgent } from "../lib/request";
import { resolvePreferences, type Preferences } from "@/lib/preferences";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type NotificationInput = {
  type: "link_viewed" | "link_locked" | "security" | "welcome" | "system";
  title: string;
  body?: string;
  href?: string;
};

const PREF_FOR_TYPE: Partial<Record<NotificationInput["type"], keyof Preferences>> = {
  link_viewed: "notifyOnView",
  link_locked: "notifyOnLock",
  security: "notifyOnSecurity",
};

/** Creates a bell notification unless the user switched that kind off in Settings. */
export async function notify(userId: string, input: NotificationInput, db: Db | Tx = getDb()) {
  const pref = PREF_FOR_TYPE[input.type];
  if (pref) {
    const [row] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId)).limit(1);
    if (!row || resolvePreferences(row.preferences)[pref] === false) return;
  }
  await db.insert(notifications).values({
    userId,
    type: input.type,
    title: input.title.slice(0, 160),
    body: input.body?.slice(0, 400) ?? null,
    href: input.href ?? null,
  });
}

export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "login_2fa_failed"
  | "logout"
  | "password_changed"
  | "2fa_enabled"
  | "2fa_disabled"
  | "backup_codes_regenerated"
  | "backup_code_used"
  | "sessions_revoked"
  | "data_exported";

const SECURITY_ALERTS: Partial<Record<SecurityEventType, string>> = {
  password_changed: "Your password was changed",
  "2fa_enabled": "Two-factor authentication turned on",
  "2fa_disabled": "Two-factor authentication turned off",
  backup_code_used: "A backup code was used to sign in",
  login_2fa_failed: "Someone entered your password but failed the 2FA check",
};

/** Appends to the account's security log and raises a bell alert for sensitive changes. */
export async function recordSecurityEvent(c: Context, userId: string, type: SecurityEventType) {
  const db = getDb();
  await db.insert(securityEvents).values({ userId, type, ipHash: clientIpHash(c), userAgent: userAgent(c) });
  const alert = SECURITY_ALERTS[type];
  if (alert) {
    await notify(userId, {
      type: "security",
      title: alert,
      body: "If this wasn’t you, change your password and sign out other devices.",
      href: "/settings?tab=security",
    });
  }
}
