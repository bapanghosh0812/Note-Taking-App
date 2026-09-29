import "server-only";
import { timingSafeEqual } from "node:crypto";
import { and, isNotNull, lt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { getDb } from "../db";
import { notes, notifications, rateLimits, sessions } from "../db/schema";
import { env } from "../env";
import { ApiError } from "../lib/errors";
import type { AppEnv } from "../middleware";
import { TRASH_RETENTION_DAYS } from "./notes";

/**
 * Daily housekeeping, triggered by Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; without the secret configured the
 * endpoint is disabled.
 */
export const cronRoutes = new Hono<AppEnv>().get("/cleanup", async (c) => {
  const secret = env().CRON_SECRET;
  const given = Buffer.from(c.req.header("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new ApiError(401, "unauthorized", "Not allowed.");
  }

  const db = getDb();
  const [trash, expiredSessions, limits, oldNotifications] = await Promise.all([
    db.delete(notes).where(lt(notes.deletedAt, sql`now() - make_interval(days => ${TRASH_RETENTION_DAYS})`)).returning({ id: notes.id }),
    db.delete(sessions).where(lt(sessions.expiresAt, sql`now()`)).returning({ id: sessions.id }),
    db.delete(rateLimits).where(lt(rateLimits.resetAt, sql`now() - interval '1 hour'`)).returning({ key: rateLimits.key }),
    db
      .delete(notifications)
      .where(and(isNotNull(notifications.readAt), lt(notifications.createdAt, sql`now() - interval '90 days'`)))
      .returning({ id: notifications.id }),
  ]);

  return c.json({
    purged: { trashedNotes: trash.length, sessions: expiredSessions.length, rateLimits: limits.length, notifications: oldNotifications.length },
  });
});
