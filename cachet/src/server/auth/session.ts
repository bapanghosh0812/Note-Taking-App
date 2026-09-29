import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { sessions, users, type User } from "../db/schema";
import { env, isProduction } from "../env";
import { generateToken, sha256 } from "../lib/crypto";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RENEW_THRESHOLD_MS = SESSION_TTL_MS / 2; // slide expiry when half the lifetime is used

/**
 * `__Host-` prefix makes the browser reject the cookie unless it is Secure,
 * host-only and Path=/ — it cannot be planted by a sibling subdomain.
 * Browsers only allow it over HTTPS, so plain-HTTP local dev uses a normal name.
 */
export function secureCookiesEnabled() {
  return isProduction() || (env().APP_URL ?? "").startsWith("https://");
}

export function sessionCookieName() {
  return secureCookiesEnabled() ? "__Host-cachet_session" : "cachet_session";
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "preferences" | "createdAt">;

export async function createSession(userId: string, meta: { userAgent: string | null; ipHash: string }) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb()
    .insert(sessions)
    .values({ id: sha256(token), userId, expiresAt, userAgent: meta.userAgent, ipHash: meta.ipHash });
  return { token, expiresAt };
}

/**
 * Resolves a cookie token to a user. Returns the new expiry when the session
 * was slid forward so the caller can refresh the cookie.
 */
export async function validateSession(token: string | undefined) {
  if (!token || token.length !== 43) return null;
  const db = getDb();
  const sessionId = sha256(token);

  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        preferences: users.preferences,
        createdAt: users.createdAt,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);

  if (!row) return null;

  let renewedExpiresAt: Date | null = null;
  if (row.expiresAt.getTime() - Date.now() < RENEW_THRESHOLD_MS) {
    renewedExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db
      .update(sessions)
      .set({ expiresAt: renewedExpiresAt, lastSeenAt: sql`now()` })
      .where(eq(sessions.id, sessionId));
  }

  return { sessionId, user: row.user as SessionUser, renewedExpiresAt };
}

export async function deleteSession(token: string) {
  await getDb().delete(sessions).where(eq(sessions.id, sha256(token)));
}
