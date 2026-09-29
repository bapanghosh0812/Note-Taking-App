import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { sessionCookieName, validateSession } from "./session";

/**
 * Session lookup for Server Components (layouts/pages). Memoized per request.
 * API routes use the Hono middleware instead. Server Components cannot set
 * cookies, so sliding renewal is left to the next API request.
 */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const token = store.get(sessionCookieName())?.value;
  const session = await validateSession(token, { renew: false });
  return session?.user ?? null;
});
