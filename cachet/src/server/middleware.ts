import "server-only";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { env } from "./env";
import {
  SESSION_TTL_MS,
  secureCookiesEnabled,
  sessionCookieName,
  validateSession,
  type SessionUser,
} from "./auth/session";
import { ApiError } from "./lib/errors";

export type AppEnv = {
  /** Set only by in-process calls from Server Components (see server/prefetch.ts). */
  Bindings: { internalPrefetch?: boolean };
  Variables: {
    user: SessionUser | null;
    sessionId: string | null;
  };
};

export type AuthedEnv = {
  Bindings: AppEnv["Bindings"];
  Variables: {
    user: SessionUser;
    sessionId: string;
  };
};

export function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string, expiresAt: Date) {
  setCookie(c, sessionCookieName(), token, {
    httpOnly: true, // not readable from JavaScript → XSS cannot steal it
    secure: secureCookiesEnabled(),
    sameSite: "Lax", // not sent on cross-site POSTs → CSRF protection layer #1
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(c: Parameters<typeof deleteCookie>[0]) {
  deleteCookie(c, sessionCookieName(), { path: "/", secure: secureCookiesEnabled() });
}

/** Attaches the signed-in user (or null) to every request. */
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, sessionCookieName());
  // In-process prefetches can't deliver a refreshed cookie, so they never renew.
  const session = await validateSession(token, { renew: c.env?.internalPrefetch !== true });
  c.set("user", session?.user ?? null);
  c.set("sessionId", session?.sessionId ?? null);
  if (session?.renewedExpiresAt && token) setSessionCookie(c, token, session.renewedExpiresAt);
  await next();
});

export const requireAuth = createMiddleware<AuthedEnv>(async (c, next) => {
  if (!c.get("user")) throw new ApiError(401, "unauthorized", "Please sign in to continue.");
  await next();
});

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF protection layer #2: state-changing requests must originate from our
 * own site. Browsers always send `Origin` on cross-origin POST/PATCH/DELETE,
 * and a page cannot forge it.
 */
export const originCheck = createMiddleware(async (c, next) => {
  if (SAFE_METHODS.has(c.req.method)) return next();

  const origin = c.req.header("origin");
  const allowed = new Set([new URL(c.req.url).origin]);
  const appUrl = env().APP_URL;
  if (appUrl) allowed.add(new URL(appUrl).origin);

  if (origin) {
    if (!allowed.has(origin)) throw new ApiError(403, "forbidden", "Cross-site request blocked.");
  } else if (c.req.header("sec-fetch-site") && c.req.header("sec-fetch-site") !== "same-origin") {
    throw new ApiError(403, "forbidden", "Cross-site request blocked.");
  }
  await next();
});

/**
 * Rejects oversized bodies before they are read. Browsers always send
 * Content-Length for fetch() bodies; chunked uploads (no length) are refused
 * with 411 so a client can't stream an unbounded body past the check.
 */
export function bodyLimit(maxBytes: number) {
  return createMiddleware(async (c, next) => {
    const length = c.req.header("content-length");
    if (length !== undefined) {
      if (!/^\d+$/.test(length) || Number(length) > maxBytes) {
        throw new ApiError(413, "bad_request", "Request body is too large.");
      }
    } else if (c.req.header("transfer-encoding")) {
      throw new ApiError(411, "bad_request", "Content-Length is required.");
    }
    await next();
  });
}

/** API responses are private and must never be stored by a browser or CDN cache. */
export const noStore = createMiddleware(async (c, next) => {
  await next();
  // A handler may opt in to caching explicitly (e.g. the versioned avatar image).
  if (c.res.headers.get("Cache-Control")) return;
  c.header("Cache-Control", "no-store, max-age=0");
  c.header("Pragma", "no-cache");
});
