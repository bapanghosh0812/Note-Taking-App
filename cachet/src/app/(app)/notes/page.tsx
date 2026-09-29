import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/current-user";
import { NotesView } from "./notes-view";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage() {
  const user = await getCurrentUser();
  return <NotesView firstName={user?.name.split(" ")[0] ?? "there"} />;
}
