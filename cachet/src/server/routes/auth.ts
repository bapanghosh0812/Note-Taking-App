import "server-only";
import { eq } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { Hono } from "hono";
import { loginSchema, registerSchema } from "@/lib/validation";
import { createSession, deleteSession, sessionCookieName } from "../auth/session";
import { getDb } from "../db";
import { users } from "../db/schema";
import { getDummyHash, hashSecret, verifySecret } from "../lib/crypto";
import { ApiError } from "../lib/errors";
import { RULES, enforce } from "../lib/rate-limit";
import { clientIpHash, userAgent } from "../lib/request";
import { clearSessionCookie, setSessionCookie, type AppEnv } from "../middleware";
import { validate } from "../validation-hook";

export const authRoutes = new Hono<AppEnv>()
  .post("/register", validate("json", registerSchema), async (c) => {
    const ipHash = clientIpHash(c);
    await enforce(RULES.registerPerIp, ipHash);

    const { name, email, password } = c.req.valid("json");
    const passwordHash = await hashSecret(password);

    // ON CONFLICT DO NOTHING turns a duplicate-email race into a clean 409 instead of a 500.
    const [user] = await getDb()
      .insert(users)
      .values({ name, email, passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id, name: users.name, email: users.email });
    if (!user) throw new ApiError(409, "conflict", "An account with this email already exists.");

    const session = await createSession(user.id, { userAgent: userAgent(c), ipHash });
    setSessionCookie(c, session.token, session.expiresAt);
    return c.json({ user }, 201);
  })

  .post("/login", validate("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const ipHash = clientIpHash(c);
    await enforce(RULES.loginPerIp, ipHash);
    await enforce(RULES.loginPerEmail, email);

    const [user] = await getDb()
      .select({ id: users.id, name: users.name, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Always run one scrypt verification so response time doesn't reveal whether the email exists.
    const valid = await verifySecret(password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !valid) throw new ApiError(401, "unauthorized", "Incorrect email or password.");

    const session = await createSession(user.id, { userAgent: userAgent(c), ipHash });
    setSessionCookie(c, session.token, session.expiresAt);
    return c.json({ user: { id: user.id, name: user.name, email: user.email } });
  })

  .post("/logout", async (c) => {
    const token = getCookie(c, sessionCookieName());
    if (token) await deleteSession(token);
    clearSessionCookie(c);
    return c.json({ ok: true });
  })

  .get("/me", (c) => {
    const user = c.get("user");
    if (!user) throw new ApiError(401, "unauthorized", "Not signed in.");
    return c.json({ user });
  });
