"use client";

import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api-client";
import { noteKey, notesKey, notesSearch, type NotesQuery } from "@/lib/query-keys";

export { noteKey, notesKey, type NotesQuery };

export function useNotes(query: NotesQuery = {}) {
  return useQuery({
    queryKey: notesKey(query),
    queryFn: () =>
      unwrap(api.notes.$get({ query: notesSearch(query) })),
    placeholderData: (prev) => prev,
  });
}

export function useNote(id: string) {
  return useQuery({
    queryKey: noteKey(id),
    queryFn: () => unwrap(api.notes[":id"].$get({ param: { id } })),
    // Keeps view counts and statuses live while the owner watches the page.
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
}

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: () => unwrap(api.notes.tags.$get()), staleTime: 30_000 });
}

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai-status"],
    queryFn: () => unwrap(api.ai.status.$get()),
    staleTime: 5 * 60_000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => unwrap(api.notifications.$get({ query: { limit: "30" } })),
    refetchInterval: 30_000,
  });
}
