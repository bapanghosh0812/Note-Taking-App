import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { Hono, type Context } from "hono";
import { loginSchema, registerSchema, twoFactorLoginSchema } from "@/lib/validation";
import { createSession, deleteSession, sessionCookieName } from "../auth/session";
import { getDb } from "../db";
import { users } from "../db/schema";
import { getDummyHash, hashSecret, sha256, verifySecret } from "../lib/crypto";
import { ApiError } from "../lib/errors";
import { RULES, enforce } from "../lib/rate-limit";
import { clientIpHash, userAgent } from "../lib/request";
import { open } from "../lib/secret-box";
import { readTicket, issueTicket } from "../lib/ticket";
import { verifyTotp } from "../lib/totp";
import { clearSessionCookie, setSessionCookie, type AppEnv } from "../middleware";
import { notify, recordSecurityEvent } from "../services/activity";
import { validate } from "../validation-hook";

async function startSession(c: Context, userId: string) {
  const session = await createSession(userId, { userAgent: userAgent(c), ipHash: clientIpHash(c) });
  setSessionCookie(c, session.token, session.expiresAt);
  await recordSecurityEvent(c, userId, "login_success");
}

export const authRoutes = new Hono<AppEnv>()
  .post("/register", validate("json", registerSchema), async (c) => {
    await enforce(RULES.registerPerIp, clientIpHash(c));
    const { name, email, password } = c.req.valid("json");
    const passwordHash = await hashSecret(password);

    // ON CONFLICT DO NOTHING turns a duplicate-email race into a clean 409 instead of a 500.
    const [user] = await getDb()
      .insert(users)
      .values({ name, email, passwordHash, termsAcceptedAt: sql`now()` })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id, name: users.name, email: users.email });
    if (!user) throw new ApiError(409, "conflict", "An account with this email already exists.");

    await startSession(c, user.id);
    await notify(user.id, {
      type: "welcome",
      title: `Welcome to Cachet, ${name.split(" ")[0]}!`,
      body: "Create your first sealed note, then turn on two-factor authentication in Settings → Security.",
      href: "/notes/new",
    });
    return c.json({ user }, 201);
  })

  .post("/login", validate("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    await enforce(RULES.loginPerIp, clientIpHash(c));
    await enforce(RULES.loginPerEmail, email);

    const [user] = await getDb()
      .select({ id: users.id, name: users.name, email: users.email, passwordHash: users.passwordHash, totpEnabledAt: users.totpEnabledAt })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Always run one scrypt verification so response time doesn't reveal whether the email exists.
    const valid = await verifySecret(password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !valid) {
      if (user) await recordSecurityEvent(c, user.id, "login_failed");
      throw new ApiError(401, "unauthorized", "Incorrect email or password.");
    }

    // Password is right but the account has 2FA: no session yet, just a 5-minute ticket for step 2.
    if (user.totpEnabledAt) {
      return c.json({ mfaRequired: true as const, ticket: issueTicket(user.id), user: null });
    }

    await startSession(c, user.id);
    return c.json({ mfaRequired: false as const, ticket: null, user: { id: user.id, name: user.name, email: user.email } });
  })

  .post("/login/2fa", validate("json", twoFactorLoginSchema), async (c) => {
    const { ticket, code } = c.req.valid("json");
    const userId = readTicket(ticket);
    if (!userId) throw new ApiError(401, "unauthorized", "Your sign-in expired. Please enter your password again.");
    // 6-digit codes are guessable in ~10^6 tries — cap attempts per account.
    await enforce(RULES.totpPerUser, userId);

    const db = getDb();
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, totpSecret: users.totpSecret, totpEnabledAt: users.totpEnabledAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user?.totpEnabledAt || !user.totpSecret) throw new ApiError(401, "unauthorized", "Two-factor authentication is not enabled.");

    let ok = false;
    const digits = code.replace(/\s/g, "");
    if (/^\d{6}$/.test(digits)) {
      ok = verifyTotp(open(user.totpSecret), digits);
    } else {
      // Backup code: remove it atomically so it can only ever be used once.
      const hash = sha256(code.toUpperCase().replace(/[^A-Z0-9]/g, ""));
      const [used] = await db
        .update(users)
        .set({ backupCodes: sql`${users.backupCodes} - ${hash}::text` })
        .where(and(eq(users.id, user.id), sql`${users.backupCodes} ? ${hash}`))
        .returning({ id: users.id });
      ok = Boolean(used);
      if (ok) await recordSecurityEvent(c, user.id, "backup_code_used");
    }

    if (!ok) {
      await recordSecurityEvent(c, user.id, "login_2fa_failed");
      throw new ApiError(401, "unauthorized", "That code isn’t right. Check your authenticator app and try again.");
    }

    await startSession(c, user.id);
    return c.json({ user: { id: user.id, name: user.name, email: user.email } });
  })

  .post("/logout", async (c) => {
    const token = getCookie(c, sessionCookieName());
    const user = c.get("user");
    if (token) await deleteSession(token);
    if (user) await recordSecurityEvent(c, user.id, "logout");
    clearSessionCookie(c);
    return c.json({ ok: true });
  })

  .get("/me", (c) => {
    const user = c.get("user");
    if (!user) throw new ApiError(401, "unauthorized", "Not signed in.");
    return c.json({ user });
  });
