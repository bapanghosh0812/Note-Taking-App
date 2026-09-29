"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { stripMarkdown } from "@/components/notes/note-card";
import { useNoteActions } from "@/components/notes/note-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotes } from "@/hooks/use-notes";
import { useNow } from "@/hooks/use-now";
import { api, errorMessage, unwrap } from "@/lib/api-client";

const RETENTION_DAYS = 30;

export function TrashView() {
  const queryClient = useQueryClient();
  const now = useNow(60_000);
  const { data, isLoading } = useNotes({ view: "trash" });
  const { restore, destroy } = useNoteActions();
  const [confirm, setConfirm] = useState<{ id: string; title: string } | "all" | null>(null);
  const notes = data?.notes ?? [];

  const emptyTrash = useMutation({
    mutationFn: () => unwrap(api.notes.trash.empty.$post()),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success(`Permanently deleted ${res.removed} note${res.removed === 1 ? "" : "s"}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Workspace</p>
          <h1 className="font-display mt-2 text-5xl tracking-tight">Trash</h1>
          <p className="text-muted-foreground mt-2 max-w-xl text-sm">
            Notes stay here for {RETENTION_DAYS} days, then are deleted forever. Moving a note to trash revoked all of its share links.
          </p>
        </div>
        <Button variant="destructive" disabled={!notes.length || emptyTrash.isPending} onClick={() => setConfirm("all")}>
          {emptyTrash.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />} Empty trash
        </Button>
      </div>

      <div className="mt-8 space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        ) : !notes.length ? (
          <div className="border-border text-muted-foreground rounded-3xl border border-dashed px-6 py-20 text-center">
            <Trash2 className="mx-auto mb-3 size-8 opacity-50" />
            Trash is empty.
          </div>
        ) : (
          notes.map((note) => {
            const daysLeft = Math.max(0, RETENTION_DAYS - Math.floor((now - new Date(note.deletedAt!).getTime()) / 86_400_000));
            return (
              <div key={note.id} className="hairline bg-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{note.title}</p>
                  <p className="text-muted-foreground truncate text-sm">{stripMarkdown(note.excerpt) || "Empty note"}</p>
                  <p className="text-warning mt-1 text-xs">Deleted forever in {daysLeft} day{daysLeft === 1 ? "" : "s"}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => restore.mutate(note.id)} disabled={restore.isPending}>
                    <ArchiveRestore /> Restore
                  </Button>
                  <Button variant="ghost" size="sm" className="hover:text-destructive" onClick={() => setConfirm({ id: note.id, title: note.title })}>
                    <Trash2 /> Delete forever
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">
              {confirm === "all" ? "Empty the trash?" : "Delete this note forever?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "all"
                ? `All ${notes.length} notes in the trash, their links and their activity will be permanently erased.`
                : `“${typeof confirm === "object" && confirm ? confirm.title : ""}”, its links and activity will be permanently erased.`}{" "}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => (confirm === "all" ? emptyTrash.mutate() : confirm && destroy.mutate(confirm.id))}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
