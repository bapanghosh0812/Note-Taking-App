/**
 * React Query cache keys. A plain module (not "use client") so Server Components
 * can prefetch into exactly the keys the client hooks read.
 */
export type NotesQuery = {
  q?: string;
  view?: "all" | "pinned" | "archived" | "trash" | "shared";
  tag?: string;
  sort?: "updated" | "created" | "title";
};

export const notesKey = (query: NotesQuery = {}) => ["notes", query] as const;
export const noteKey = (id: string) => ["note", id] as const;

/** Query string for GET /api/notes — only the filters that are set. */
export function notesSearch(query: NotesQuery) {
  return {
    ...(query.q ? { q: query.q } : {}),
    ...(query.view ? { view: query.view } : {}),
    ...(query.tag ? { tag: query.tag } : {}),
    ...(query.sort ? { sort: query.sort } : {}),
  };
}
