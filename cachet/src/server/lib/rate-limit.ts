import "server-only";
import { lt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { rateLimits } from "../db/schema";
import { ApiError } from "./errors";

export type RateLimitRule = {
  /** Namespace, e.g. "login:ip". */
  name: string;
  limit: number;
  windowSeconds: number;
};

export const RULES = {
  loginPerIp: { name: "login:ip", limit: 20, windowSeconds: 15 * 60 },
  loginPerEmail: { name: "login:email", limit: 8, windowSeconds: 15 * 60 },
  registerPerIp: { name: "register:ip", limit: 5, windowSeconds: 60 * 60 },
  shareAccessPerIp: { name: "share:ip", limit: 60, windowSeconds: 60 },
  shareUnlockPerIp: { name: "unlock:ip", limit: 20, windowSeconds: 10 * 60 },
  aiPerUser: { name: "ai:user", limit: 60, windowSeconds: 60 * 60 },
  totpPerUser: { name: "2fa:user", limit: 6, windowSeconds: 15 * 60 },
  feedbackPerUser: { name: "feedback:user", limit: 10, windowSeconds: 60 * 60 },
  writePerUser: { name: "write:user", limit: 120, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

/**
 * Fixed-window counter stored in Postgres, so the limit holds across every
 * serverless instance (an in-memory Map would reset per instance).
 *
 * The whole check is ONE atomic upsert: concurrent requests are serialized on
 * the row lock, so the counter can never be under-counted.
 */
export async function consume(rule: RateLimitRule, subject: string) {
  const db = getDb();
  const key = `${rule.name}:${subject}`.slice(0, 200);
  const window = sql`make_interval(secs => ${rule.windowSeconds})`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: sql`now() + ${window}` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} <= now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= now() THEN now() + ${window} ELSE ${rateLimits.resetAt} END`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

  // Opportunistic cleanup of stale windows (~1% of calls) keeps the table small without a cron job.
  if (Math.random() < 0.01) {
    await db.delete(rateLimits).where(lt(rateLimits.resetAt, sql`now() - interval '1 hour'`));
  }

  const retryAfter = Math.max(1, Math.ceil((row!.resetAt.getTime() - Date.now()) / 1000));
  return { allowed: row!.count <= rule.limit, remaining: Math.max(0, rule.limit - row!.count), retryAfter };
}

/** Consume and throw a 429 if the limit is exceeded. */
export async function enforce(rule: RateLimitRule, subject: string) {
  const result = await consume(rule, subject);
  if (!result.allowed) {
    throw new ApiError(429, "rate_limited", "Too many requests. Please slow down and try again shortly.", {
      retryAfter: result.retryAfter,
    });
  }
  return result;
}
