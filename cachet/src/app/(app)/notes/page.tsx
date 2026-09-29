import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { resolvePreferences } from "@/lib/preferences";
import { notesKey, notesSearch, type NotesQuery } from "@/lib/query-keys";
import { getCurrentUser } from "@/server/auth/current-user";
import { prefetchApi } from "@/server/prefetch";
import { NotesView } from "./notes-view";

export const metadata: Metadata = { title: "Notes" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  // Must match the key NotesView builds on first render (empty search box).
  const query: NotesQuery = {
    q: "",
    view: (one(params.view) as NotesQuery["view"]) ?? "all",
    tag: one(params.tag),
    sort: resolvePreferences(user?.preferences).notesSort,
  };
  const state = await prefetchApi([[notesKey(query), `/api/notes?${new URLSearchParams(notesSearch(query))}`]]);
  return (
    <HydrationBoundary state={state}>
      {/* No <Suspense> here: this route is always rendered per request, and a large
          boundary would be streamed hidden and revealed late (slower first paint). */}
      <NotesView />
    </HydrationBoundary>
  );
}
