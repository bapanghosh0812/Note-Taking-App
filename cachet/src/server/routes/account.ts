import "server-only";
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, ne, sql, sum } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { preferencesPatchSchema, resolvePreferences } from "@/lib/preferences";
import {
  changePasswordSchema,
  deleteAccountSchema,
  feedbackSchema,
  profileSchema,
  totpCodeSchema,
} from "@/lib/validation";
import { getDb } from "../db";
import { feedback, notes, securityEvents, sessions, shareLinks, users } from "../db/schema";
import { hashSecret, sha256, verifySecret } from "../lib/crypto";
import { AVATAR_MAX_BYTES, avatarUrl, detectImageType } from "../lib/image";
import { ApiError } from "../lib/errors";
import { RULES, enforce } from "../lib/rate-limit";
import { open, seal } from "../lib/secret-box";
import { generateBackupCodes, generateTotpSecret, otpauthUri, verifyTotp } from "../lib/totp";
import { clearSessionCookie, requireAuth, type AuthedEnv } from "../middleware";
import { recordSecurityEvent } from "../services/activity";
import { linkStatus } from "../services/share";
import { validate } from "../validation-hook";

async function assertPassword(userId: string, password: string) {
  const [row] = await getDb().select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row || !(await verifySecret(password, row.hash))) {
    throw new ApiError(401, "unauthorized", "That password is not correct.", { fields: { password: "Incorrect password" } });
  }
}

const normalizeBackupCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function issueBackupCodes(userId: string) {
  const codes = generateBackupCodes();
  await getDb()
    .update(users)
    .set({ backupCodes: codes.map((code) => sha256(normalizeBackupCode(code))) })
    .where(eq(users.id, userId));
  return codes;
}

const passwordOnly = z.object({ password: z.string().min(1, "Enter your password").max(128) });

export const accountRoutes = new Hono<AuthedEnv>()
  .use(requireAuth)

  /* ------------------------------- profile ------------------------------- */

  .get("/", async (c) => {
    const me = c.get("user");
    const db = getDb();
    const [row] = await db
      .select({
        name: users.name,
        email: users.email,
        bio: users.bio,
        avatarColor: users.avatarColor,
        avatarUpdatedAt: users.avatarUpdatedAt,
        preferences: users.preferences,
        totpEnabledAt: users.totpEnabledAt,
        backupCodes: users.backupCodes,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, me.id))
      .limit(1);
    const [noteStats] = await db
      .select({ total: count(), pinned: sql<number>`count(*) filter (where ${notes.pinned})`.mapWith(Number) })
      .from(notes)
      .where(and(eq(notes.ownerId, me.id), isNull(notes.deletedAt)));
    const [linkStats] = await db
      .select({ total: count(), views: sum(shareLinks.viewCount).mapWith(Number) })
      .from(shareLinks)
      .innerJoin(notes, eq(notes.id, shareLinks.noteId))
      .where(eq(notes.ownerId, me.id));

    return c.json({
      profile: {
        name: row!.name,
        email: row!.email,
        bio: row!.bio,
        avatarColor: row!.avatarColor,
        avatarUrl: avatarUrl(row!.avatarUpdatedAt),
        createdAt: row!.createdAt.toISOString(),
        twoFactorEnabled: Boolean(row!.totpEnabledAt),
        twoFactorEnabledAt: row!.totpEnabledAt?.toISOString() ?? null,
        backupCodesRemaining: row!.backupCodes.length,
      },
      preferences: resolvePreferences(row!.preferences),
      stats: { notes: noteStats?.total ?? 0, pinned: noteStats?.pinned ?? 0, links: linkStats?.total ?? 0, views: linkStats?.views ?? 0 },
    });
  })

  .patch("/", validate("json", profileSchema), async (c) => {
    const { name, bio, avatarColor } = c.req.valid("json");
    const [updated] = await getDb()
      .update(users)
      .set({
        ...(name ? { name } : {}),
        ...(bio !== undefined ? { bio: bio || null } : {}),
        ...(avatarColor ? { avatarColor } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, c.get("user").id))
      .returning({ name: users.name, bio: users.bio, avatarColor: users.avatarColor });
    return c.json({ profile: updated! });
  })

  /* ------------------------------- avatar -------------------------------- */

  /** The signed-in user's own photo. URLs are versioned (?v=), so it can be cached forever. */
  .get("/avatar", async (c) => {
    const [row] = await getDb()
      .select({ image: users.avatarImage, mime: users.avatarMime })
      .from(users)
      .where(eq(users.id, c.get("user").id))
      .limit(1);
    if (!row?.image || !row.mime) throw new ApiError(404, "not_found", "No profile photo");
    c.header("Content-Type", row.mime);
    c.header("Cache-Control", "private, max-age=31536000, immutable");
    c.header("Content-Security-Policy", "default-src 'none'");
    return c.body(new Uint8Array(row.image));
  })

  /** Raw image body (the browser sends a 256×256 WebP/JPEG it has already resized). */
  .put("/avatar", async (c) => {
    const user = c.get("user");
    await enforce(RULES.writePerUser, user.id);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.length === 0) throw new ApiError(400, "bad_request", "No image received.");
    if (bytes.length > AVATAR_MAX_BYTES) throw new ApiError(413, "bad_request", "That image is too large (max 100 KB after resizing).");
    const mime = detectImageType(bytes);
    if (!mime) throw new ApiError(415, "bad_request", "Please upload a JPEG, PNG or WebP image.");
    const [row] = await getDb()
      .update(users)
      .set({ avatarImage: Buffer.from(bytes), avatarMime: mime, avatarUpdatedAt: sql`now()` })
      .where(eq(users.id, user.id))
      .returning({ avatarUpdatedAt: users.avatarUpdatedAt });
    return c.json({ avatarUrl: avatarUrl(row!.avatarUpdatedAt) });
  })

  .delete("/avatar", async (c) => {
    await getDb().update(users).set({ avatarImage: null, avatarMime: null, avatarUpdatedAt: null }).where(eq(users.id, c.get("user").id));
    return c.json({ avatarUrl: null });
  })

  .patch("/preferences", validate("json", preferencesPatchSchema), async (c) => {
    const patch = c.req.valid("json");
    // jsonb "||" merges, so keys not in this request are kept.
    const [row] = await getDb()
      .update(users)
      .set({ preferences: sql`${users.preferences} || ${JSON.stringify(patch)}::jsonb`, updatedAt: sql`now()` })
      .where(eq(users.id, c.get("user").id))
      .returning({ preferences: users.preferences });
    return c.json({ preferences: resolvePreferences(row!.preferences) });
  })

  .post("/preferences/reset", async (c) => {
    await getDb().update(users).set({ preferences: {} }).where(eq(users.id, c.get("user").id));
    return c.json({ preferences: resolvePreferences({}) });
  })

  /* ------------------------------- security ------------------------------ */

  .post("/password", validate("json", changePasswordSchema), async (c) => {
    const user = c.get("user");
    await enforce(RULES.loginPerEmail, user.email);
    const { currentPassword, newPassword } = c.req.valid("json");
    await assertPassword(user.id, currentPassword);
    const db = getDb();
    await db.update(users).set({ passwordHash: await hashSecret(newPassword), updatedAt: sql`now()` }).where(eq(users.id, user.id));
    // A password change signs out every other device (e.g. a thief who had the old password).
    await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.id, c.get("sessionId"))));
    await recordSecurityEvent(c, user.id, "password_changed");
    return c.json({ ok: true });
  })

  .get("/security-log", async (c) => {
    const events = await getDb()
      .select({ id: securityEvents.id, type: securityEvents.type, userAgent: securityEvents.userAgent, createdAt: securityEvents.createdAt })
      .from(securityEvents)
      .where(eq(securityEvents.userId, c.get("user").id))
      .orderBy(desc(securityEvents.createdAt))
      .limit(50);
    return c.json({ events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })) });
  })

  /** Step 1 of enabling 2FA: create a secret (not active yet) and return it for the QR code. */
  .post("/2fa/setup", async (c) => {
    const user = c.get("user");
    const db = getDb();
    const [row] = await db.select({ enabled: users.totpEnabledAt }).from(users).where(eq(users.id, user.id)).limit(1);
    if (row?.enabled) throw new ApiError(409, "conflict", "Two-factor authentication is already on.");
    const secret = generateTotpSecret();
    await db.update(users).set({ totpSecret: seal(secret) }).where(eq(users.id, user.id));
    return c.json({ secret, otpauthUri: otpauthUri(secret, user.email) });
  })

  /** Step 2: prove the app is set up by entering a current code; returns backup codes once. */
  .post("/2fa/enable", validate("json", totpCodeSchema), async (c) => {
    const user = c.get("user");
    await enforce(RULES.totpPerUser, user.id);
    const db = getDb();
    const [row] = await db.select({ secret: users.totpSecret, enabled: users.totpEnabledAt }).from(users).where(eq(users.id, user.id)).limit(1);
    if (row?.enabled) throw new ApiError(409, "conflict", "Two-factor authentication is already on.");
    if (!row?.secret) throw new ApiError(400, "bad_request", "Start the setup first.");
    if (!verifyTotp(open(row.secret), c.req.valid("json").code)) {
      throw new ApiError(401, "unauthorized", "That code isn’t right. Make sure your phone’s time is correct.", { fields: { code: "Incorrect code" } });
    }
    await db.update(users).set({ totpEnabledAt: sql`now()` }).where(and(eq(users.id, user.id), isNotNull(users.totpSecret)));
    const backupCodes = await issueBackupCodes(user.id);
    await recordSecurityEvent(c, user.id, "2fa_enabled");
    return c.json({ backupCodes });
  })

  .post("/2fa/disable", validate("json", passwordOnly), async (c) => {
    const user = c.get("user");
    await enforce(RULES.loginPerEmail, user.email);
    await assertPassword(user.id, c.req.valid("json").password);
    await getDb().update(users).set({ totpSecret: null, totpEnabledAt: null, backupCodes: [] }).where(eq(users.id, user.id));
    await recordSecurityEvent(c, user.id, "2fa_disabled");
    return c.json({ ok: true });
  })

  .post("/2fa/backup-codes", validate("json", passwordOnly), async (c) => {
    const user = c.get("user");
    await enforce(RULES.loginPerEmail, user.email);
    await assertPassword(user.id, c.req.valid("json").password);
    const [row] = await getDb().select({ enabled: users.totpEnabledAt }).from(users).where(eq(users.id, user.id)).limit(1);
    if (!row?.enabled) throw new ApiError(409, "conflict", "Turn on two-factor authentication first.");
    const backupCodes = await issueBackupCodes(user.id);
    await recordSecurityEvent(c, user.id, "backup_codes_regenerated");
    return c.json({ backupCodes });
  })

  /* ------------------------------- sessions ------------------------------ */

  .get("/sessions", async (c) => {
    const rows = await getDb()
      .select({ id: sessions.id, userAgent: sessions.userAgent, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt })
      .from(sessions)
      .where(and(eq(sessions.userId, c.get("user").id), gt(sessions.expiresAt, sql`now()`)))
      .orderBy(desc(sessions.lastSeenAt));
    const current = c.get("sessionId");
    return c.json({
      sessions: rows.map((s) => ({
        id: s.id.slice(0, 16), // short handle; the full id is never exposed
        current: s.id === current,
        userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
      })),
    });
  })

  .delete("/sessions/:handle", validate("param", z.object({ handle: z.string().regex(/^[a-f0-9]{16}$/) })), async (c) => {
    const user = c.get("user");
    const { handle } = c.req.valid("param");
    const removed = await getDb()
      .delete(sessions)
      .where(and(eq(sessions.userId, user.id), sql`left(${sessions.id}, 16) = ${handle}`))
      .returning({ id: sessions.id });
    if (removed.some((s) => s.id === c.get("sessionId"))) clearSessionCookie(c);
    if (removed.length) await recordSecurityEvent(c, user.id, "sessions_revoked");
    return c.json({ removed: removed.length });
  })

  .post("/sessions/revoke-others", async (c) => {
    const user = c.get("user");
    const removed = await getDb()
      .delete(sessions)
      .where(and(eq(sessions.userId, user.id), ne(sessions.id, c.get("sessionId"))))
      .returning({ id: sessions.id });
    if (removed.length) await recordSecurityEvent(c, user.id, "sessions_revoked");
    return c.json({ removed: removed.length });
  })

  /* --------------------------------- data -------------------------------- */

  .get("/export", async (c) => {
    const user = c.get("user");
    const db = getDb();
    const userNotes = await db.select().from(notes).where(eq(notes.ownerId, user.id)).orderBy(desc(notes.createdAt));
    const links = userNotes.length
      ? await db.select().from(shareLinks).where(inArray(shareLinks.noteId, userNotes.map((n) => n.id)))
      : [];
    await recordSecurityEvent(c, user.id, "data_exported");
    c.header("Content-Disposition", `attachment; filename="cachet-export-${new Date().toISOString().slice(0, 10)}.json"`);
    return c.json({
      exportedAt: new Date().toISOString(),
      account: { name: user.name, email: user.email, createdAt: user.createdAt },
      notes: userNotes.map((n) => ({
        title: n.title,
        content: n.content,
        tags: n.tags,
        pinned: n.pinned,
        archived: Boolean(n.archivedAt),
        inTrash: Boolean(n.deletedAt),
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        shareLinks: links
          .filter((l) => l.noteId === n.id)
          .map((l) => ({
            label: l.label,
            shareType: l.shareType,
            accessType: l.accessType,
            status: linkStatus(l),
            expiresAt: l.expiresAt,
            viewCount: l.viewCount,
            createdAt: l.createdAt,
          })),
      })),
    });
  })

  .post("/feedback", validate("json", feedbackSchema), async (c) => {
    const user = c.get("user");
    await enforce(RULES.feedbackPerUser, user.id);
    const { kind, message, page } = c.req.valid("json");
    await getDb().insert(feedback).values({ userId: user.id, kind, message, page: page ?? null });
    return c.json({ ok: true }, 201);
  })

  .delete("/", validate("json", deleteAccountSchema), async (c) => {
    const user = c.get("user");
    await enforce(RULES.loginPerEmail, user.email);
    await assertPassword(user.id, c.req.valid("json").password);
    // Cascades to sessions, notes, share links, view logs, notifications and the security log.
    await getDb().delete(users).where(eq(users.id, user.id));
    clearSessionCookie(c);
    return c.json({ ok: true });
  });
