import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { NoteDetail } from "./note-detail";

export const metadata: Metadata = { title: "Note" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function NotePage({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  return <NoteDetail id={id} preferences={user?.preferences ?? {}} />;
}
