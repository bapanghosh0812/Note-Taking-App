import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/current-user";
import { NewNoteForm } from "./new-note-form";

export const metadata: Metadata = { title: "New note" };

export default async function NewNotePage() {
  const user = await getCurrentUser();
  return <NewNoteForm preferences={user?.preferences ?? {}} />;
}
