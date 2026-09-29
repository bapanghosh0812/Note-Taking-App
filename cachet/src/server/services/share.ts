import "server-only";
import { and, eq, gt, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "../db";
import { notes, shareLinks, shareViews, users, type ShareLink } from "../db/schema";
import {
  TOKEN_PATTERN,
  generateAccessKey,
  generateToken,
  hashSecret,
  normalizeAccessKey,
  sha256,
  verifySecret,
} from "../lib/crypto";
import { ApiError } from "../lib/errors";
import type { ShareSettings } from "@/lib/validation";

/** Wrong keys allowed before a link is temporarily locked. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export type LinkStatus = "active" | "used" | "expired" | "revoked" | "locked";

/** Precedence: an explicit revoke wins, then consumption, then time expiry. */
export function linkStatus(link: Pick<ShareLink, "revokedAt" | "consumedAt" | "expiresAt" | "lockedUntil">, now = new Date()): LinkStatus {
  if (link.revokedAt) return "revoked";
  if (link.consumedAt) return "used";
  if (link.expiresAt <= now) return "expired";
  if (link.lockedUntil && link.lockedUntil > now) return "locked";
  return "active";
}

const STATUS_ERRORS: Record<Exclude<LinkStatus, "active" | "locked">, ApiError> = {
  revoked: new ApiError(410, "link_revoked", "This link was revoked by its owner."),
  used: new ApiError(410, "link_used", "This one-time link has already been opened."),
  expired: new ApiError(410, "link_expired", "This link has expired."),
};

const invalidLink = () => new ApiError(404, "link_invalid", "This link is invalid or does not exist.");

/* ------------------------------------------------------------------ */
/* Creating links                                                      */
/* ------------------------------------------------------------------ */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/**
 * Creates a link and returns the raw token + key exactly once.
 * Only hashes are persisted, so they can never be shown again.
 */
export async function createShareLink(noteId: string, settings: ShareSettings, tx: Tx | ReturnType<typeof getDb> = getDb()) {
  const token = generateToken();
  const accessKey = settings.accessType === "password" ? generateAccessKey() : null;
  const keyHash = accessKey ? await hashSecret(normalizeAccessKey(accessKey)) : null;

  const [link] = await tx
    .insert(shareLinks)
    .values({
      noteId,
      tokenHash: sha256(token),
      tokenPrefix: token.slice(0, 6),
      label: settings.label ?? null,
      shareType: settings.shareType,
      accessType: settings.accessType,
      keyHash,
      expiresAt: settings.expiresAt,
    })
    .returning();

  return { link: link!, token, accessKey };
}

/** Issues a fresh key; the old key stops working immediately and any lockout is cleared. */
export async function regenerateAccessKey(linkId: string) {
  const accessKey = generateAccessKey();
  const keyHash = await hashSecret(normalizeAccessKey(accessKey));
  const [link] = await getDb()
    .update(shareLinks)
    .set({ keyHash, failedAttempts: 0, lockedUntil: null })
    .where(
      and(
        eq(shareLinks.id, linkId),
        eq(shareLinks.accessType, "password"),
        isNull(shareLinks.revokedAt),
        isNull(shareLinks.consumedAt),
        gt(shareLinks.expiresAt, sql`now()`),
      ),
    )
    .returning();
  if (!link) throw new ApiError(409, "conflict", "Only active password-protected links can get a new key.");
  return { link, accessKey };
}

/** Idempotent: revoking twice keeps the original revoke time. */
export async function revokeLink(linkId: string) {
  const [link] = await getDb()
    .update(shareLinks)
    .set({ revokedAt: sql`coalesce(${shareLinks.revokedAt}, now())` })
    .where(eq(shareLinks.id, linkId))
    .returning();
  return link;
}

/* ------------------------------------------------------------------ */
/* Reading links (public side)                                         */
/* ------------------------------------------------------------------ */

async function findByToken(token: string) {
  // Malformed tokens never touch the database.
  if (!TOKEN_PATTERN.test(token)) return null;
  const [link] = await getDb()
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.tokenHash, sha256(token)))
    .limit(1);
  return link ?? null;
}

/** Metadata for the landing screen. Never returns note content and never counts a view. */
export async function getShareMeta(token: string) {
  const link = await findByToken(token);
  if (!link) throw invalidLink();
  const status = linkStatus(link);
  if (status !== "active" && status !== "locked") throw STATUS_ERRORS[status];
  return {
    shareType: link.shareType,
    accessType: link.accessType,
    expiresAt: link.expiresAt.toISOString(),
    lockedUntil: status === "locked" ? link.lockedUntil!.toISOString() : null,
  };
}

type AccessContext = { ipHash: string; userAgent: string | null; country: string | null };

/**
 * The one code path that reveals note content.
 *
 * 1. Cheap pre-checks give precise errors (invalid / revoked / used / expired / locked).
 * 2. For password links an attempt slot is reserved atomically BEFORE the key
 *    is checked, so even a burst of parallel guesses can never evaluate more
 *    than MAX_FAILED_ATTEMPTS keys per lock window. A wrong key never touches
 *    the view count.
 * 3. The view is "claimed" with a single conditional UPDATE. Postgres row locks
 *    serialize concurrent claims; after the first one commits, the others
 *    re-evaluate the WHERE clause, see `consumed_at IS NOT NULL`, and match
 *    zero rows. Exactly one caller can ever win a one-time link.
 */
export async function accessSharedNote(token: string, providedKey: string | undefined, ctx: AccessContext) {
  const link = await findByToken(token);
  if (!link) throw invalidLink();

  const status = linkStatus(link);
  if (status === "locked") throw lockedError(link.lockedUntil!);
  if (status !== "active") throw STATUS_ERRORS[status];

  if (link.accessType === "password") {
    const key = normalizeAccessKey(providedKey ?? "");
    if (!key) throw new ApiError(401, "key_required", "This note is protected. Enter the access key to unlock it.");
    await reserveAttempt(link.id);
    const ok = await verifySecret(key, link.keyHash!);
    if (!ok) await recordFailedAttempt(link.id);
  }

  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(shareLinks)
      .set({
        viewCount: sql`${shareLinks.viewCount} + 1`,
        lastViewedAt: sql`now()`,
        consumedAt: sql`CASE WHEN ${shareLinks.shareType} = 'one_time' THEN now() ELSE NULL END`,
        failedAttempts: 0,
      })
      .where(
        and(
          eq(shareLinks.id, link.id),
          isNull(shareLinks.revokedAt),
          isNull(shareLinks.consumedAt),
          gt(shareLinks.expiresAt, sql`now()`),
          or(isNull(shareLinks.lockedUntil), lte(shareLinks.lockedUntil, sql`now()`)),
          // The key we verified must still be the current key (it may have been regenerated meanwhile).
          link.keyHash ? eq(shareLinks.keyHash, link.keyHash) : isNull(shareLinks.keyHash),
        ),
      )
      .returning({ id: shareLinks.id, viewCount: shareLinks.viewCount, expiresAt: shareLinks.expiresAt });

    if (!claimed) return null;

    await tx.insert(shareViews).values({
      linkId: link.id,
      method: link.accessType,
      ipHash: ctx.ipHash,
      userAgent: ctx.userAgent,
      country: ctx.country,
    });

    const [note] = await tx
      .select({ title: notes.title, content: notes.content, updatedAt: notes.updatedAt, ownerName: users.name })
      .from(notes)
      .innerJoin(users, eq(users.id, notes.ownerId))
      .where(eq(notes.id, link.noteId))
      .limit(1);

    return { claimed, note: note! };
  });

  if (!result) {
    // We lost a race (another request consumed/revoked it between our read and our claim).
    const fresh = await findByToken(token);
    if (!fresh) throw invalidLink();
    const freshStatus = linkStatus(fresh);
    if (freshStatus === "locked") throw lockedError(fresh.lockedUntil!);
    if (freshStatus !== "active") throw STATUS_ERRORS[freshStatus];
    throw new ApiError(409, "conflict", "The link changed while opening. Please try again.");
  }

  return {
    note: {
      title: result.note.title,
      content: result.note.content,
      updatedAt: result.note.updatedAt.toISOString(),
      sharedBy: result.note.ownerName,
    },
    link: {
      shareType: link.shareType,
      accessType: link.accessType,
      expiresAt: result.claimed.expiresAt.toISOString(),
      consumed: link.shareType === "one_time",
    },
  };
}

const lockInterval = sql`make_interval(mins => ${LOCK_MINUTES})`;

/**
 * Takes one of the MAX_FAILED_ATTEMPTS guess slots. The condition and the
 * increment are a single UPDATE, so parallel requests cannot over-book slots.
 * If no slot is free the link is (or becomes) locked.
 */
async function reserveAttempt(linkId: string) {
  const db = getDb();
  const [reserved] = await db
    .update(shareLinks)
    .set({ failedAttempts: sql`${shareLinks.failedAttempts} + 1` })
    .where(
      and(
        eq(shareLinks.id, linkId),
        lt(shareLinks.failedAttempts, MAX_FAILED_ATTEMPTS),
        or(isNull(shareLinks.lockedUntil), lte(shareLinks.lockedUntil, sql`now()`)),
      ),
    )
    .returning({ id: shareLinks.id });
  if (reserved) return;

  // Already locked, or every slot is taken by in-flight guesses: (keep) lock the link.
  const [row] = await db
    .update(shareLinks)
    .set({
      lockedUntil: sql`CASE WHEN ${shareLinks.lockedUntil} > now() THEN ${shareLinks.lockedUntil} ELSE now() + ${lockInterval} END`,
      failedAttempts: 0,
    })
    .where(eq(shareLinks.id, linkId))
    .returning({ lockedUntil: shareLinks.lockedUntil });
  throw lockedError(row?.lockedUntil ?? new Date(Date.now() + LOCK_MINUTES * 60_000));
}

/**
 * The reserved slot stays counted. Once all slots are used the link locks for
 * LOCK_MINUTES and the counter resets (both columns are computed from the
 * same pre-update row, in one statement).
 */
async function recordFailedAttempt(linkId: string): Promise<never> {
  const [row] = await getDb()
    .update(shareLinks)
    .set({
      lockedUntil: sql`CASE WHEN ${shareLinks.failedAttempts} >= ${MAX_FAILED_ATTEMPTS} THEN now() + ${lockInterval} ELSE ${shareLinks.lockedUntil} END`,
      failedAttempts: sql`CASE WHEN ${shareLinks.failedAttempts} >= ${MAX_FAILED_ATTEMPTS} THEN 0 ELSE ${shareLinks.failedAttempts} END`,
    })
    .where(eq(shareLinks.id, linkId))
    .returning({ failedAttempts: shareLinks.failedAttempts, lockedUntil: shareLinks.lockedUntil });

  if (row?.lockedUntil && row.lockedUntil > new Date()) throw lockedError(row.lockedUntil);
  throw new ApiError(401, "key_invalid", "That access key is not correct.", {
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - (row?.failedAttempts ?? 0)),
  });
}

function lockedError(until: Date) {
  return new ApiError(423, "link_locked", "Too many wrong keys. This link is temporarily locked.", {
    lockedUntil: until.toISOString(),
    retryAfter: Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000)),
  });
}
