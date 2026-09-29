import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { noteKey } from "@/lib/query-keys";
import { prefetchApi } from "@/server/prefetch";
import { NoteDetail } from "./note-detail";

export const metadata: Metadata = { title: "Note" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function NotePage({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const state = await prefetchApi([
    [noteKey(id), `/api/notes/${id}`],
    [["ai-status"], "/api/ai/status"],
  ]);
  return (
    <HydrationBoundary state={state}>
      <NoteDetail id={id} />
    </HydrationBoundary>
  );
}
