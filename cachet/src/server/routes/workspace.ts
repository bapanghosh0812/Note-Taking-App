import "server-only";
import { and, count, desc, eq, gt, ilike, isNull, lt, or, sql, sum } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "../db";
import { notes, notifications, sessions, shareLinks, shareViews, users } from "../db/schema";
import { requireAuth, type AuthedEnv } from "../middleware";
import { linkStatus } from "../services/share";
import { validate } from "../validation-hook";
import { serializeLink } from "./notes";

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export const dashboardRoutes = new Hono<AuthedEnv>()
  .use(requireAuth)
  .get("/", async (c) => {
    const user = c.get("user");
    const db = getDb();
    const ownNotes = and(eq(notes.ownerId, user.id), isNull(notes.deletedAt));

    const [[noteCounts], [linkCounts], viewsByDay, recentViews, expiringSoon, recentNotes, [account], [unread]] = await Promise.all([
      db
        .select({
          total: count(),
          pinned: sql<number>`count(*) filter (where ${notes.pinned})`.mapWith(Number),
          archived: sql<number>`count(*) filter (where ${notes.archivedAt} is not null)`.mapWith(Number),
          words: sql<number>`coalesce(sum(coalesce(array_length(regexp_split_to_array(trim(${notes.content}), '\\s+'), 1), 0)), 0)`.mapWith(Number),
        })
        .from(notes)
        .where(ownNotes),
      db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where ${shareLinks.revokedAt} is null and ${shareLinks.consumedAt} is null and ${shareLinks.expiresAt} > now())`.mapWith(Number),
          views: sum(shareLinks.viewCount).mapWith(Number),
        })
        .from(shareLinks)
        .innerJoin(notes, eq(notes.id, shareLinks.noteId))
        .where(eq(notes.ownerId, user.id)),
      // 14 days, zero-filled, so the chart has no gaps.
      db.execute<{ day: string; views: number }>(sql`
        select to_char(d.day, 'YYYY-MM-DD') as day, count(v.id)::int as views
        from generate_series(current_date - 13, current_date, interval '1 day') as d(day)
        left join ${shareViews} v on v.viewed_at >= d.day and v.viewed_at < d.day + interval '1 day'
          and v.link_id in (select l.id from ${shareLinks} l join ${notes} n on n.id = l.note_id where n.owner_id = ${user.id})
        group by d.day order by d.day`),
      db
        .select({
          id: shareViews.id,
          viewedAt: shareViews.viewedAt,
          method: shareViews.method,
          userAgent: shareViews.userAgent,
          noteId: notes.id,
          noteTitle: notes.title,
          label: shareLinks.label,
        })
        .from(shareViews)
        .innerJoin(shareLinks, eq(shareLinks.id, shareViews.linkId))
        .innerJoin(notes, eq(notes.id, shareLinks.noteId))
        .where(eq(notes.ownerId, user.id))
        .orderBy(desc(shareViews.viewedAt))
        .limit(8),
      db
        .select({ id: shareLinks.id, noteId: notes.id, noteTitle: notes.title, label: shareLinks.label, expiresAt: shareLinks.expiresAt, shareType: shareLinks.shareType })
        .from(shareLinks)
        .innerJoin(notes, eq(notes.id, shareLinks.noteId))
        .where(
          and(
            eq(notes.ownerId, user.id),
            isNull(shareLinks.revokedAt),
            isNull(shareLinks.consumedAt),
            gt(shareLinks.expiresAt, sql`now()`),
            lt(shareLinks.expiresAt, sql`now() + interval '48 hours'`),
          ),
        )
        .orderBy(shareLinks.expiresAt)
        .limit(5),
      db
        .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt, color: notes.color, pinned: notes.pinned })
        .from(notes)
        .where(and(ownNotes, isNull(notes.archivedAt)))
        .orderBy(desc(notes.updatedAt))
        .limit(5),
      db
        .select({
          totp: users.totpEnabledAt,
          bio: users.bio,
          sessionCount: sql<number>`(select count(*) from ${sessions} where ${sessions.userId} = ${user.id} and ${sessions.expiresAt} > now())`.mapWith(Number),
        })
        .from(users)
        .where(eq(users.id, user.id)),
      db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
    ]);

    const views7d = viewsByDay.slice(-7).reduce((n, d) => n + Number(d.views), 0);
    const prev7d = viewsByDay.slice(0, 7).reduce((n, d) => n + Number(d.views), 0);

    return c.json({
      stats: {
        notes: noteCounts?.total ?? 0,
        pinned: noteCounts?.pinned ?? 0,
        archived: noteCounts?.archived ?? 0,
        words: noteCounts?.words ?? 0,
        links: linkCounts?.total ?? 0,
        activeLinks: linkCounts?.active ?? 0,
        views: linkCounts?.views ?? 0,
        views7d,
        prev7d,
        unread: unread?.n ?? 0,
      },
      viewsByDay: viewsByDay.map((d) => ({ day: d.day, views: Number(d.views) })),
      recentViews: recentViews.map((v) => ({ ...v, viewedAt: v.viewedAt.toISOString() })),
      expiringSoon: expiringSoon.map((l) => ({ ...l, expiresAt: l.expiresAt.toISOString() })),
      recentNotes: recentNotes.map((n) => ({ ...n, updatedAt: n.updatedAt.toISOString() })),
      security: { twoFactor: Boolean(account?.totp), sessions: account?.sessionCount ?? 0 },
      onboarding: {
        createdNote: (noteCounts?.total ?? 0) > 0,
        sharedNote: (linkCounts?.total ?? 0) > 0,
        linkOpened: (linkCounts?.views ?? 0) > 0,
        twoFactor: Boolean(account?.totp),
        profile: Boolean(account?.bio),
      },
    });
  });

/* ------------------------------------------------------------------ */
/* All share links across notes                                        */
/* ------------------------------------------------------------------ */

const linksQuery = z.object({
  status: z.enum(["all", "active", "used", "expired", "revoked", "locked"]).default("all"),
  q: z.string().trim().max(100).optional(),
});

export const linksRoutes = new Hono<AuthedEnv>()
  .use(requireAuth)
  .get("/", validate("query", linksQuery), async (c) => {
    const { status, q } = c.req.valid("query");
    const pattern = q ? `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
    const rows = await getDb()
      .select({ link: shareLinks, noteTitle: notes.title, noteDeleted: notes.deletedAt })
      .from(shareLinks)
      .innerJoin(notes, eq(notes.id, shareLinks.noteId))
      .where(
        and(
          eq(notes.ownerId, c.get("user").id),
          pattern ? or(ilike(notes.title, pattern), ilike(shareLinks.label, pattern), ilike(shareLinks.tokenPrefix, pattern)) : undefined,
        ),
      )
      .orderBy(desc(shareLinks.createdAt))
      .limit(500);

    const links = rows
      .map((r) => ({ ...serializeLink(r.link), noteTitle: r.noteTitle, noteInTrash: Boolean(r.noteDeleted) }))
      .filter((l) => status === "all" || l.status === status);
    const counts = rows.reduce<Record<string, number>>((acc, r) => {
      const s = linkStatus(r.link);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
    return c.json({ links, counts: { all: rows.length, ...counts } });
  });

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const notificationsRoutes = new Hono<AuthedEnv>()
  .use(requireAuth)
  .get("/", validate("query", z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) })), async (c) => {
    const user = c.get("user");
    const db = getDb();
    const [items, [unread]] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(c.req.valid("query").limit),
      db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
    ]);
    return c.json({
      unread: unread?.n ?? 0,
      notifications: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        href: n.href,
        read: Boolean(n.readAt),
        createdAt: n.createdAt.toISOString(),
      })),
    });
  })
  .post("/read-all", async (c) => {
    await getDb()
      .update(notifications)
      .set({ readAt: sql`now()` })
      .where(and(eq(notifications.userId, c.get("user").id), isNull(notifications.readAt)));
    return c.json({ ok: true });
  })
  .post("/:id/read", validate("param", z.object({ id: z.string().uuid() })), async (c) => {
    await getDb()
      .update(notifications)
      .set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
      .where(and(eq(notifications.id, c.req.valid("param").id), eq(notifications.userId, c.get("user").id)));
    return c.json({ ok: true });
  })
  .delete("/", async (c) => {
    await getDb().delete(notifications).where(eq(notifications.userId, c.get("user").id));
    return c.json({ ok: true });
  });
