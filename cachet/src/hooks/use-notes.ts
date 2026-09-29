"use client";

import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api-client";

export const notesKey = (q = "") => ["notes", q] as const;
export const noteKey = (id: string) => ["note", id] as const;

export function useNotes(q = "") {
  return useQuery({
    queryKey: notesKey(q),
    queryFn: () => unwrap(api.notes.$get({ query: q ? { q } : {} })),
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

export function useAiStatus() {
  return useQuery({
    queryKey: ["ai-status"],
    queryFn: () => unwrap(api.ai.status.$get()),
    staleTime: 5 * 60_000,
  });
}
