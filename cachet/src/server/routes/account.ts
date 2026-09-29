import "server-only";
import { and, desc, eq, gt, inArray, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { changePasswordSchema, deleteAccountSchema, profileSchema } from "@/lib/validation";
import { getDb } from "../db";
import { notes, sessions, shareLinks, users } from "../db/schema";
import { hashSecret, verifySecret } from "../lib/crypto";
import { ApiError } from "../lib/errors";
import { RULES, enforce } from "../lib/rate-limit";
import { clearSessionCookie, requireAuth, type AuthedEnv } from "../middleware";
import { linkStatus } from "../services/share";
import { validate } from "../validation-hook";

async function assertPassword(userId: string, password: string) {
  const [row] = await getDb().select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row || !(await verifySecret(password, row.hash))) {
    throw new ApiError(401, "unauthorized", "That password is not correct.", { fields: { password: "Incorrect password" } });
  }
}

export const accountRoutes = new Hono<AuthedEnv>()
  .use(requireAuth)

  .patch("/", validate("json", profileSchema), async (c) => {
    const user = c.get("user");
    const { name, preferences } = c.req.valid("json");
    const [updated] = await getDb()
      .update(users)
      .set({
        ...(name ? { name } : {}),
        // jsonb merge keeps preferences that were not part of this request.
        ...(preferences ? { preferences: sql`${users.preferences} || ${JSON.stringify(preferences)}::jsonb` } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, user.id))
      .returning({ id: users.id, name: users.name, email: users.email, preferences: users.preferences });
    return c.json({ user: updated! });
  })

  .post("/password", validate("json", changePasswordSchema), async (c) => {
    const user = c.get("user");
    await enforce(RULES.loginPerEmail, user.email);
    const { currentPassword, newPassword } = c.req.valid("json");
    await assertPassword(user.id, currentPassword);
    const db = getDb();
    await db.update(users).set({ passwordHash: await hashSecret(newPassword), updatedAt: sql`now()` }).where(eq(users.id, user.id));
    // A password change signs out every other device (e.g. a thief who had the old password).
    await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.id, c.get("sessionId"))));
    return c.json({ ok: true });
  })

  .get("/sessions", async (c) => {
    const rows = await getDb()
      .select({ id: sessions.id, userAgent: sessions.userAgent, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt, expiresAt: sessions.expiresAt })
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
    return c.json({ removed: removed.length });
  })

  .post("/sessions/revoke-others", async (c) => {
    const removed = await getDb()
      .delete(sessions)
      .where(and(eq(sessions.userId, c.get("user").id), ne(sessions.id, c.get("sessionId"))))
      .returning({ id: sessions.id });
    return c.json({ removed: removed.length });
  })

  .get("/export", async (c) => {
    const user = c.get("user");
    const db = getDb();
    const userNotes = await db.select().from(notes).where(eq(notes.ownerId, user.id)).orderBy(desc(notes.createdAt));
    const links = userNotes.length
      ? await db.select().from(shareLinks).where(inArray(shareLinks.noteId, userNotes.map((n) => n.id)))
      : [];
    c.header("Content-Disposition", `attachment; filename="cachet-export-${new Date().toISOString().slice(0, 10)}.json"`);
    return c.json({
      exportedAt: new Date().toISOString(),
      account: { name: user.name, email: user.email, createdAt: user.createdAt },
      notes: userNotes.map((n) => ({
        title: n.title,
        content: n.content,
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

  .delete("/", validate("json", deleteAccountSchema), async (c) => {
    const user = c.get("user");
    await enforce(RULES.loginPerEmail, user.email);
    await assertPassword(user.id, c.req.valid("json").password);
    // Cascades to sessions, notes, share links and view logs.
    await getDb().delete(users).where(eq(users.id, user.id));
    clearSessionCookie(c);
    return c.json({ ok: true });
  });
