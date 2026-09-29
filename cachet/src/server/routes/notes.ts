import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, or, sql, sum } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { createNoteSchema, shareSettingsSchema, updateNoteSchema } from "@/lib/validation";
import { getDb } from "../db";
import { notes, shareLinks, shareViews, type ShareLink } from "../db/schema";
import { env } from "../env";
import { notFound } from "../lib/errors";
import { RULES, enforce } from "../lib/rate-limit";
import { requireAuth, type AuthedEnv } from "../middleware";
import { createShareLink, linkStatus, regenerateAccessKey, revokeLink } from "../services/share";
import { validate } from "../validation-hook";

const idParam = z.object({ id: z.string().uuid() });
const linkParam = z.object({ id: z.string().uuid(), linkId: z.string().uuid() });
const listQuery = z.object({ q: z.string().trim().max(100).optional() });

function shareUrl(c: Context, token: string) {
  const origin = env().APP_URL ?? new URL(c.req.url).origin;
  return `${origin.replace(/\/$/, "")}/share/${token}`;
}

/** Public shape of a link for its owner. Hashes never leave the server. */
function serializeLink(link: ShareLink) {
  return {
    id: link.id,
    label: link.label,
    tokenPrefix: link.tokenPrefix,
    shareType: link.shareType,
    accessType: link.accessType,
    status: linkStatus(link),
    expiresAt: link.expiresAt.toISOString(),
    consumedAt: link.consumedAt?.toISOString() ?? null,
    revokedAt: link.revokedAt?.toISOString() ?? null,
    lockedUntil: link.lockedUntil?.toISOString() ?? null,
    viewCount: link.viewCount,
    lastViewedAt: link.lastViewedAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
  };
}

/**
 * Loads a note only if it belongs to the current user. Someone else's note is
 * reported as "not found" (not "forbidden") so IDs cannot be probed.
 */
async function getOwnedNote(noteId: string, ownerId: string) {
  const [note] = await getDb()
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, ownerId)))
    .limit(1);
  if (!note) throw notFound("Note");
  return note;
}

async function getOwnedLink(noteId: string, linkId: string, ownerId: string) {
  await getOwnedNote(noteId, ownerId);
  const [link] = await getDb()
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.id, linkId), eq(shareLinks.noteId, noteId)))
    .limit(1);
  if (!link) throw notFound("Share link");
  return link;
}

export const notesRoutes = new Hono<AuthedEnv>()
  .use(requireAuth)

  .get("/", validate("query", listQuery), async (c) => {
    const user = c.get("user");
    const { q } = c.req.valid("query");
    const db = getDb();

    // Escape LIKE wildcards so a search for "%" is literal.
    const pattern = q ? `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
    const rows = await db
      .select({
        id: notes.id,
        title: notes.title,
        excerpt: sql<string>`left(${notes.content}, 220)`,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(
        and(
          eq(notes.ownerId, user.id),
          pattern ? or(ilike(notes.title, pattern), ilike(notes.content, pattern)) : undefined,
        ),
      )
      .orderBy(desc(notes.updatedAt))
      .limit(200);

    const ids = rows.map((r) => r.id);
    const stats = ids.length
      ? await db
          .select({
            noteId: shareLinks.noteId,
            links: count(),
            active: sql<number>`count(*) filter (where ${shareLinks.revokedAt} is null and ${shareLinks.consumedAt} is null and ${shareLinks.expiresAt} > now())`.mapWith(Number),
            views: sum(shareLinks.viewCount).mapWith(Number),
          })
          .from(shareLinks)
          .where(inArray(shareLinks.noteId, ids))
          .groupBy(shareLinks.noteId)
      : [];
    const byNote = new Map(stats.map((s) => [s.noteId, s]));

    return c.json({
      notes: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        links: byNote.get(r.id)?.links ?? 0,
        activeLinks: byNote.get(r.id)?.active ?? 0,
        views: byNote.get(r.id)?.views ?? 0,
      })),
    });
  })

  .post("/", validate("json", createNoteSchema), async (c) => {
    const user = c.get("user");
    await enforce(RULES.writePerUser, user.id);
    const { title, content, share } = c.req.valid("json");

    // Note + first link are created atomically: never a note without its link or vice versa.
    const result = await getDb().transaction(async (tx) => {
      const [note] = await tx.insert(notes).values({ ownerId: user.id, title, content }).returning();
      const created = await createShareLink(note!.id, share, tx);
      return { note: note!, ...created };
    });

    return c.json(
      {
        note: { id: result.note.id, title: result.note.title },
        link: serializeLink(result.link),
        shareUrl: shareUrl(c, result.token),
        accessKey: result.accessKey,
      },
      201,
    );
  })

  .get("/:id", validate("param", idParam), async (c) => {
    const user = c.get("user");
    const note = await getOwnedNote(c.req.valid("param").id, user.id);
    const links = await getDb()
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.noteId, note.id))
      .orderBy(desc(shareLinks.createdAt));

    return c.json({
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      },
      links: links.map(serializeLink),
    });
  })

  .patch(
    "/:id",
    validate("param", idParam),
    validate("json", updateNoteSchema),
    async (c) => {
      const user = c.get("user");
      await enforce(RULES.writePerUser, user.id);
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const [note] = await getDb()
        .update(notes)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)))
        .returning();
      if (!note) throw notFound("Note");
      return c.json({ note: { id: note.id, title: note.title, content: note.content, updatedAt: note.updatedAt.toISOString() } });
    },
  )

  .delete("/:id", validate("param", idParam), async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    // Links and view logs are removed by ON DELETE CASCADE, so every share URL dies with the note.
    const deleted = await getDb()
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.ownerId, user.id)))
      .returning({ id: notes.id });
    if (!deleted.length) throw notFound("Note");
    return c.json({ ok: true });
  })

  /* ----------------------------- share links ----------------------------- */

  .post(
    "/:id/links",
    validate("param", idParam),
    validate("json", shareSettingsSchema),
    async (c) => {
      const user = c.get("user");
      await enforce(RULES.writePerUser, user.id);
      const note = await getOwnedNote(c.req.valid("param").id, user.id);
      const { link, token, accessKey } = await createShareLink(note.id, c.req.valid("json"));
      return c.json({ link: serializeLink(link), shareUrl: shareUrl(c, token), accessKey }, 201);
    },
  )

  .post("/:id/links/revoke-all", validate("param", idParam), async (c) => {
    const user = c.get("user");
    const note = await getOwnedNote(c.req.valid("param").id, user.id);
    const revoked = await getDb()
      .update(shareLinks)
      .set({ revokedAt: sql`now()` })
      .where(and(eq(shareLinks.noteId, note.id), isNull(shareLinks.revokedAt)))
      .returning({ id: shareLinks.id });
    return c.json({ revoked: revoked.length });
  })

  .post("/:id/links/:linkId/revoke", validate("param", linkParam), async (c) => {
    const { id, linkId } = c.req.valid("param");
    await getOwnedLink(id, linkId, c.get("user").id);
    const link = await revokeLink(linkId);
    return c.json({ link: serializeLink(link!) });
  })

  .post("/:id/links/:linkId/regenerate-key", validate("param", linkParam), async (c) => {
    const user = c.get("user");
    await enforce(RULES.writePerUser, user.id);
    const { id, linkId } = c.req.valid("param");
    await getOwnedLink(id, linkId, user.id);
    const { link, accessKey } = await regenerateAccessKey(linkId);
    return c.json({ link: serializeLink(link), accessKey });
  })

  .get("/:id/links/:linkId/views", validate("param", linkParam), async (c) => {
    const { id, linkId } = c.req.valid("param");
    await getOwnedLink(id, linkId, c.get("user").id);
    const views = await getDb()
      .select({
        id: shareViews.id,
        viewedAt: shareViews.viewedAt,
        method: shareViews.method,
        userAgent: shareViews.userAgent,
        country: shareViews.country,
      })
      .from(shareViews)
      .where(eq(shareViews.linkId, linkId))
      .orderBy(desc(shareViews.viewedAt))
      .limit(50);
    return c.json({ views: views.map((v) => ({ ...v, viewedAt: v.viewedAt.toISOString() })) });
  });
