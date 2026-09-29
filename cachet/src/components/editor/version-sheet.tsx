"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { Markdown } from "@/components/lazy-markdown";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage, unwrap } from "@/lib/api-client";
import { friendlyDate, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stats } from "./markdown-format";

export function VersionSheet({
  noteId,
  open,
  onOpenChange,
  onRestored,
}: {
  noteId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRestored: (note: { title: string; content: string }) => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["versions", noteId],
    queryFn: () => unwrap(api.notes[":id"].versions.$get({ param: { id: noteId } })),
    enabled: open,
  });
  const versions = data?.versions ?? [];
  const current = versions.find((v) => v.id === selected) ?? versions[0];

  const restore = useMutation({
    mutationFn: (versionId: number) => unwrap(api.notes[":id"].versions[":versionId"].restore.$post({ param: { id: noteId, versionId: String(versionId) } })),
    onSuccess: async (res) => {
      onRestored({ title: res.note.title, content: res.note.content });
      await queryClient.invalidateQueries({ queryKey: ["versions", noteId] });
      await queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      toast.success("Version restored — your previous text was saved as a new version.");
      onOpenChange(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-border border-b px-5 py-4">
          <SheetTitle className="font-display flex items-center gap-2 text-2xl font-normal">
            <History className="text-gold size-5" /> Version history
          </SheetTitle>
          <SheetDescription>A snapshot is kept at most every 5 minutes while you edit (last 30 versions).</SheetDescription>
        </SheetHeader>
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : !versions.length ? (
          <p className="text-muted-foreground p-10 text-center text-sm">No earlier versions yet. Edit the note and versions will appear here.</p>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[13rem_minmax(0,1fr)]">
            <ul className="border-border max-h-48 overflow-y-auto border-b sm:max-h-none sm:border-r sm:border-b-0">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(v.id)}
                    className={cn("hover:bg-muted/50 w-full px-4 py-3 text-left transition-colors", current?.id === v.id && "bg-gold-soft")}
                  >
                    <span className="block text-sm font-medium" title={friendlyDate(v.createdAt)}>
                      {relativeTime(v.createdAt)}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {v.title} · {stats(v.content).words} words
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {current && (
              <div className="flex min-h-0 flex-col">
                <div className="flex-1 overflow-y-auto p-5">
                  <p className="font-display text-3xl">{current.title}</p>
                  <p className="text-muted-foreground mb-4 text-xs">{friendlyDate(current.createdAt)}</p>
                  <Markdown className="prose-sm">{current.content}</Markdown>
                </div>
                <div className="border-border border-t p-3">
                  <Button variant="gold" className="w-full" disabled={restore.isPending} onClick={() => restore.mutate(current.id)}>
                    {restore.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />} Restore this version
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
