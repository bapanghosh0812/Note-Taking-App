import type { Metadata } from "next";
import { Suspense } from "react";
import { NewNoteForm } from "./new-note-form";

export const metadata: Metadata = { title: "New note" };

export default function NewNotePage() {
  return (
    <Suspense>
      <NewNoteForm />
    </Suspense>
  );
}
