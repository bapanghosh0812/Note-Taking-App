import "server-only";
import { and, asc, count, desc, eq, gt, ilike, inArray, isNotNull, isNull, lt, or, sql, sum } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { createNoteSchema, extendLinkSchema, shareSettingsSchema, updateNoteSchema } from "@/lib/validation";
import { getDb } from "../db";
import { noteVersions, notes, shareLinks, shareViews, type Note, type ShareLink } from "../db/schema";
import { env } from "../env";
import { ApiError, notFound } from "../lib/errors";
import { RULES, enforce } from "../lib/rate-limit";
import { requireAuth, type AuthedEnv } from "../middleware";
import { createShareLink, linkStatus, regenerateAccessKey, revokeLink } from "../services/share";
import { validate } from "../validation-hook";

const idParam = z.object({ id: z.string().uuid() });
const linkParam = z.object({ id: z.string().uuid(), linkId: z.string().uuid() });
const versionParam = z.object({ id: z.string().uuid(), versionId: z.coerce.number().int().positive() });
const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  view: z.enum(["all", "pinned", "archived", "trash", "shared"]).default("all"),
  tag: z.string().trim().toLowerCase().max(24).optional(),
  sort: z.enum(["updated", "created", "title"]).default("updated"),
});

/** Trash is emptied automatically after this many days (see also the cron job). */
export const TRASH_RETENTION_DAYS = 30;
/** While editing, keep at most one snapshot per this many minutes (autosave would create hundreds). */
const VERSION_INTERVAL_MINUTES = 5;
const MAX_VERSIONS = 30;

export function shareUrl(c: Context, token: string) {
  const origin = env().APP_URL ?? new URL(c.req.url).origin;
  return `${origin.replace(/\/$/, "")}/share/${token}`;
}

/** Public shape of a link for its owner. Hashes never leave the server. */
export function serializeLink(link: ShareLink) {
  return {
    id: link.id,
    noteId: link.noteId,
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

function serializeNote(note: Note) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    pinned: note.pinned,
    color: note.color,
    tags: note.tags,
    archivedAt: note.archivedAt?.toISOString() ?? null,
    deletedAt: note.deletedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

/**
 * Loads a note only if it belongs to the current user. Someone else's note is
 * reported as "not found" (not "forbidden") so IDs cannot be probed.
 */
async function getOwnedNote(noteId: string, ownerId: string, opts: { allowTrashed?: boolean } = {}) {
  const [note] = await getDb()
    .select()
    .from(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, ownerId), opts.allowTrashed ? undefined : isNull(notes.deletedAt)))
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

const activeLinkFilter = sql`${shareLinks.revokedAt} is null and ${shareLinks.consumedAt} is null and ${shareLinks.expiresAt} > now()`;

export const notesRoutes = new Hono<AuthedEnv>()
  .use(requireAuth)

  .get("/", validate("query", listQuery), async (c) => {
    const user = c.get("user");
    const { q, view, tag, sort } = c.req.valid("query");
    const db = getDb();

    // Opportunistic retention: trash older than 30 days is purged whenever the owner lists notes.
    await db
      .delete(notes)
      .where(and(eq(notes.ownerId, user.id), lt(notes.deletedAt, sql`now() - make_interval(days => ${TRASH_RETENTION_DAYS})`)));

    // Escape LIKE wildcards so a search for "%" is literal.
    const pattern = q ? `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%` : null;
    const viewFilter = {
      all: and(isNull(notes.deletedAt), isNull(notes.archivedAt)),
      pinned: and(isNull(notes.deletedAt), isNull(notes.archivedAt), eq(notes.pinned, true)),
      archived: and(isNull(notes.deletedAt), isNotNull(notes.archivedAt)),
      trash: isNotNull(notes.deletedAt),
      shared: and(
        isNull(notes.deletedAt),
        sql`exists (select 1 from ${shareLinks} where ${shareLinks.noteId} = ${notes.id} and ${activeLinkFilter})`,
      ),
    }[view];
    const order = {
      updated: [desc(notes.pinned), desc(notes.updatedAt)],
      created: [desc(notes.pinned), desc(notes.createdAt)],
      title: [desc(notes.pinned), asc(sql`lower(${notes.title})`)],
    }[view === "trash" ? "updated" : sort];

    const rows = await db
      .select({
        id: notes.id,
        title: notes.title,
        excerpt: sql<string>`left(${notes.content}, 220)`,
        words: sql<number>`coalesce(array_length(regexp_split_to_array(trim(${notes.content}), '\\s+'), 1), 0)`.mapWith(Number),
        pinned: notes.pinned,
        color: notes.color,
        tags: notes.tags,
        archivedAt: notes.archivedAt,
        deletedAt: notes.deletedAt,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(
        and(
          eq(notes.ownerId, user.id),
          viewFilter,
          pattern ? or(ilike(notes.title, pattern), ilike(notes.content, pattern)) : undefined,
          tag ? sql`${tag} = any(${notes.tags})` : undefined,
        ),
      )
      .orderBy(...order)
      .limit(300);

    const ids = rows.map((r) => r.id);
    const stats = ids.length
      ? await db
          .select({
            noteId: shareLinks.noteId,
            links: count(),
            active: sql<number>`count(*) filter (where ${activeLinkFilter})`.mapWith(Number),
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
        archivedAt: r.archivedAt?.toISOString() ?? null,
        deletedAt: r.deletedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        links: byNote.get(r.id)?.links ?? 0,
        activeLinks: byNote.get(r.id)?.active ?? 0,
        views: byNote.get(r.id)?.views ?? 0,
      })),
    });
  })

  /** Every tag in use with its note count — for the sidebar and filters. */
  .get("/tags", async (c) => {
    const rows = await getDb().execute<{ tag: string; count: number }>(sql`
      select tag, count(*)::int as count
      from ${notes}, unnest(${notes.tags}) as tag
      where ${notes.ownerId} = ${c.get("user").id} and ${notes.deletedAt} is null
      group by tag order by count desc, tag asc limit 50`);
    return c.json({ tags: rows.map((r) => ({ tag: r.tag, count: Number(r.count) })) });
  })

  .post("/", validate("json", createNoteSchema), async (c) => {
    const user = c.get("user");
    await enforce(RULES.writePerUser, user.id);
    const { title, content, tags, color, pinned, share } = c.req.valid("json");

    // Note + optional first link are created atomically: never a half-created share.
    const result = await getDb().transaction(async (tx) => {
      const [note] = await tx
        .insert(notes)
        .values({ ownerId: user.id, title, content, tags: tags ?? [], color: color === "none" ? null : color, pinned: pinned ?? false })
        .returning();
      const created = share ? await createShareLink(note!.id, share, tx) : null;
      return { note: note!, created };
    });

    return c.json(
      {
        note: { id: result.note.id, title: result.note.title },
        link: result.created ? serializeLink(result.created.link) : null,
        shareUrl: result.created ? shareUrl(c, result.created.token) : null,
        accessKey: result.created?.accessKey ?? null,
      },
      201,
    );
  })

  .post("/trash/empty", async (c) => {
    const removed = await getDb()
      .delete(notes)
      .where(and(eq(notes.ownerId, c.get("user").id), isNotNull(notes.deletedAt)))
      .returning({ id: notes.id });
    return c.json({ removed: removed.length });
  })

  .get("/:id", validate("param", idParam), async (c) => {
    const user = c.get("user");
    const note = await getOwnedNote(c.req.valid("param").id, user.id, { allowTrashed: true });
    const links = await getDb()
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.noteId, note.id))
      .orderBy(desc(shareLinks.createdAt));
    return c.json({ note: serializeNote(note), links: links.map(serializeLink) });
  })

  .patch("/:id", validate("param", idParam), validate("json", updateNoteSchema), async (c) => {
    const user = c.get("user");
    await enforce(RULES.writePerUser, user.id);
    const { id } = c.req.valid("param");
    const { title, content, tags, color, pinned, archived } = c.req.valid("json");
    const db = getDb();

    const updated = await db.transaction(async (tx) => {
      // FOR UPDATE: two tabs autosaving at once can't both snapshot the same old version.
      const [current] = await tx
        .select()
        .from(notes)
        .where(and(eq(notes.id, id), eq(notes.ownerId, user.id), isNull(notes.deletedAt)))
        .for("update");
      if (!current) throw notFound("Note");

      const textChanged = (title !== undefined && title !== current.title) || (content !== undefined && content !== current.content);
      if (textChanged) {
        const [recent] = await tx
          .select({ id: noteVersions.id })
          .from(noteVersions)
          .where(and(eq(noteVersions.noteId, id), gt(noteVersions.createdAt, sql`now() - make_interval(mins => ${VERSION_INTERVAL_MINUTES})`)))
          .limit(1);
        if (!recent) {
          await tx.insert(noteVersions).values({ noteId: id, title: current.title, content: current.content });
          // Keep only the newest MAX_VERSIONS snapshots.
          await tx.execute(sql`
            delete from ${noteVersions} where ${noteVersions.noteId} = ${id} and ${noteVersions.id} not in (
              select ${noteVersions.id} from ${noteVersions} where ${noteVersions.noteId} = ${id}
              order by ${noteVersions.createdAt} desc limit ${MAX_VERSIONS})`);
        }
      }

      const [note] = await tx
        .update(notes)
        .set({
          ...(title !== undefined ? { title } : {}),
          ...(content !== undefined ? { content } : {}),
          ...(tags !== undefined ? { tags } : {}),
          ...(color !== undefined ? { color: color === "none" ? null : color } : {}),
          ...(pinned !== undefined ? { pinned } : {}),
          ...(archived !== undefined ? { archivedAt: archived ? sql`now()` : null } : {}),
          ...(textChanged ? { updatedAt: sql`now()` } : {}),
        })
        .where(eq(notes.id, id))
        .returning();
      return note!;
    });

    return c.json({ note: serializeNote(updated) });
  })

  /**
   * Move to trash. All active links are revoked in the same transaction, so a
   * trashed note can never be opened — and restoring it doesn't silently revive old links.
   */
  .delete("/:id", validate("param", idParam), async (c) => {
    const user = c.get("user");
    const { id } = c.req.valid("param");
    const revoked = await getDb().transaction(async (tx) => {
      const [note] = await tx
        .update(notes)
        .set({ deletedAt: sql`now()`, pinned: false })
        .where(and(eq(notes.id, id), eq(notes.ownerId, user.id), isNull(notes.deletedAt)))
        .returning({ id: notes.id });
      if (!note) throw notFound("Note");
      return tx
        .update(shareLinks)
        .set({ revokedAt: sql`now()` })
        .where(and(eq(shareLinks.noteId, id), isNull(shareLinks.revokedAt)))
        .returning({ id: shareLinks.id });
    });
    return c.json({ ok: true, revokedLinks: revoked.length });
  })

  .post("/:id/restore", validate("param", idParam), async (c) => {
    const [note] = await getDb()
      .update(notes)
      .set({ deletedAt: null })
      .where(and(eq(notes.id, c.req.valid("param").id), eq(notes.ownerId, c.get("user").id), isNotNull(notes.deletedAt)))
      .returning();
    if (!note) throw notFound("Note");
    return c.json({ note: serializeNote(note) });
  })

  /** Permanent delete (only from trash). Links and view logs go with it via ON DELETE CASCADE. */
  .delete("/:id/permanent", validate("param", idParam), async (c) => {
    const deleted = await getDb()
      .delete(notes)
      .where(and(eq(notes.id, c.req.valid("param").id), eq(notes.ownerId, c.get("user").id), isNotNull(notes.deletedAt)))
      .returning({ id: notes.id });
    if (!deleted.length) throw new ApiError(409, "conflict", "Move the note to trash before deleting it forever.");
    return c.json({ ok: true });
  })

  .post("/:id/duplicate", validate("param", idParam), async (c) => {
    const user = c.get("user");
    await enforce(RULES.writePerUser, user.id);
    const source = await getOwnedNote(c.req.valid("param").id, user.id);
    // Only the content is copied — share links are never duplicated.
    const [copy] = await getDb()
      .insert(notes)
      .values({
        ownerId: user.id,
        title: `${source.title} (copy)`.slice(0, 200),
        content: source.content,
        tags: source.tags,
        color: source.color,
      })
      .returning();
    return c.json({ note: serializeNote(copy!) }, 201);
  })

  .get("/:id/versions", validate("param", idParam), async (c) => {
    const note = await getOwnedNote(c.req.valid("param").id, c.get("user").id);
    const versions = await getDb()
      .select({ id: noteVersions.id, title: noteVersions.title, content: noteVersions.content, createdAt: noteVersions.createdAt })
      .from(noteVersions)
      .where(eq(noteVersions.noteId, note.id))
      .orderBy(desc(noteVersions.createdAt))
      .limit(MAX_VERSIONS);
    return c.json({ versions: versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })) });
  })

  .post("/:id/versions/:versionId/restore", validate("param", versionParam), async (c) => {
    const user = c.get("user");
    const { id, versionId } = c.req.valid("param");
    const current = await getOwnedNote(id, user.id);
    const db = getDb();
    const [version] = await db
      .select()
      .from(noteVersions)
      .where(and(eq(noteVersions.id, versionId), eq(noteVersions.noteId, id)))
      .limit(1);
    if (!version) throw notFound("Version");

    // Restoring is itself undoable: the current text becomes a new snapshot first.
    const note = await db.transaction(async (tx) => {
      await tx.insert(noteVersions).values({ noteId: id, title: current.title, content: current.content });
      const [restored] = await tx
        .update(notes)
        .set({ title: version.title, content: version.content, updatedAt: sql`now()` })
        .where(eq(notes.id, id))
        .returning();
      return restored!;
    });
    return c.json({ note: serializeNote(note) });
  })

  /* ----------------------------- share links ----------------------------- */

  .post("/:id/links", validate("param", idParam), validate("json", shareSettingsSchema), async (c) => {
    const user = c.get("user");
    await enforce(RULES.writePerUser, user.id);
    const note = await getOwnedNote(c.req.valid("param").id, user.id);
    const { link, token, accessKey } = await createShareLink(note.id, c.req.valid("json"));
    return c.json({ link: serializeLink(link), shareUrl: shareUrl(c, token), accessKey }, 201);
  })

  .post("/:id/links/revoke-all", validate("param", idParam), async (c) => {
    const note = await getOwnedNote(c.req.valid("param").id, c.get("user").id);
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

  /** Change the expiry of a link that is still active (extend or shorten). */
  .post("/:id/links/:linkId/extend", validate("param", linkParam), validate("json", extendLinkSchema), async (c) => {
    const { id, linkId } = c.req.valid("param");
    await getOwnedLink(id, linkId, c.get("user").id);
    const [link] = await getDb()
      .update(shareLinks)
      .set({ expiresAt: c.req.valid("json").expiresAt })
      .where(
        and(
          eq(shareLinks.id, linkId),
          isNull(shareLinks.revokedAt),
          isNull(shareLinks.consumedAt),
          gt(shareLinks.expiresAt, sql`now()`),
        ),
      )
      .returning();
    if (!link) throw new ApiError(409, "conflict", "Only active links can be extended. Create a new link instead.");
    return c.json({ link: serializeLink(link) });
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
      .limit(100);
    return c.json({ views: views.map((v) => ({ ...v, viewedAt: v.viewedAt.toISOString() })) });
  });
