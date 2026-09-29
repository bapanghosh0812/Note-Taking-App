"use client";

import { useQuery } from "@tanstack/react-query";
import { Globe2, KeyRound } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api, unwrap } from "@/lib/api-client";
import { describeUserAgent, friendlyDate, relativeTime } from "@/lib/format";
import type { OwnerLink } from "./link-card";

export function ActivitySheet({ noteId, link, onClose }: { noteId: string; link: OwnerLink | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["link-views", link?.id],
    queryFn: () => unwrap(api.notes[":id"].links[":linkId"].views.$get({ param: { id: noteId, linkId: link!.id } })),
    enabled: !!link,
    refetchInterval: 5000,
  });

  return (
    <Sheet open={!!link} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-3xl font-normal">Activity</SheetTitle>
          <SheetDescription>
            Successful opens of {link?.label ? `“${link.label}”` : "this link"}. Wrong keys and expired or revoked attempts are never counted.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : !data?.views.length ? (
            <p className="text-muted-foreground py-12 text-center text-sm">No one has opened this link yet.</p>
          ) : (
            <ol className="relative space-y-2">
              {data.views.map((v, i) => (
                <li key={v.id} className="border-border flex items-center gap-3 rounded-xl border p-3">
                  <span className="bg-gold-soft text-gold grid size-9 shrink-0 place-items-center rounded-full">
                    {v.method === "password" ? <KeyRound className="size-4" /> : <Globe2 className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      View #{data.views.length - i} · {v.method === "password" ? "unlocked with key" : "public view"}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {describeUserAgent(v.userAgent)}
                      {v.country ? ` · ${v.country}` : ""}
                    </p>
                  </div>
                  <time className="text-muted-foreground shrink-0 text-right text-xs" dateTime={v.viewedAt} title={friendlyDate(v.viewedAt)}>
                    {relativeTime(v.viewedAt)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
