import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { sessionCookieName, validateSession } from "./session";

/**
 * Session lookup for Server Components (layouts/pages). Memoized per request.
 * API routes use the Hono middleware instead.
 */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const token = store.get(sessionCookieName())?.value;
  const session = await validateSession(token);
  return session?.user ?? null;
});
