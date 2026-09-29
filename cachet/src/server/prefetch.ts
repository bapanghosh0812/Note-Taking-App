import "server-only";
import { QueryClient, dehydrate, type QueryKey } from "@tanstack/react-query";
import { headers } from "next/headers";
import { app } from "./app";

/**
 * Server-side data for a page's first paint. Each entry runs a GET request
 * through the real API in-process — same handlers, same auth and ownership
 * checks, same JSON the browser would receive — and seeds React Query with it,
 * so the page arrives with its content instead of loading skeletons.
 * Failed requests are skipped; the client then fetches them as usual.
 */
export async function prefetchApi(entries: [key: QueryKey, path: string][]) {
  const cookie = (await headers()).get("cookie") ?? "";
  const queryClient = new QueryClient();
  await Promise.all(
    entries.map(async ([key, path]) => {
      try {
        const res = await app.request(path, { headers: { cookie } }, { internalPrefetch: true });
        if (res.ok) queryClient.setQueryData(key, await res.json());
      } catch (error) {
        console.error(`[prefetch] ${path} failed`, error);
      }
    }),
  );
  return dehydrate(queryClient);
}
