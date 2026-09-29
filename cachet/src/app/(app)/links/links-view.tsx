"use client";

import { useQuery } from "@tanstack/react-query";
import { Link2, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { ActivitySheet } from "@/components/share/activity-sheet";
import { useLinkActions } from "@/components/share/link-actions";
import { LinkCard, type OwnerLink } from "@/components/share/link-card";
import { ShareResultDialog, type ShareResult } from "@/components/share/share-result-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, unwrap } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "active", "used", "expired", "revoked", "locked"] as const;
type Filter = (typeof FILTERS)[number];
const LABELS: Record<Filter, string> = { all: "All", active: "Active", used: "Opened", expired: "Expired", revoked: "Revoked", locked: "Locked" };

export function LinksView() {
  const router = useRouter();
  const params = useSearchParams();
  const status = (FILTERS as readonly string[]).includes(params.get("status") ?? "") ? (params.get("status") as Filter) : "all";
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const [result, setResult] = useState<ShareResult | null>(null);
  const [activity, setActivity] = useState<OwnerLink | null>(null);
  const actions = useLinkActions(setResult);

  const { data, isLoading } = useQuery({
    queryKey: ["links", status, q],
    queryFn: () => unwrap(api.links.$get({ query: { status, ...(q ? { q } : {}) } })),
    placeholderData: (prev) => prev,
    refetchInterval: 10_000,
  });
  const counts = (data?.counts ?? {}) as Record<string, number>;

  return (
    <div>
      <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Manage</p>
      <h1 className="font-display mt-2 text-5xl tracking-tight">Share links</h1>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
        Every link you have ever created, across all notes. Revoke, extend or re-key any of them from here.
      </p>

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={status === f}
              onClick={() => router.push(f === "all" ? "/links" : `/links?status=${f}`)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                status === f ? "border-gold bg-gold-soft text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {LABELS[f]}
              <span className="text-muted-foreground text-xs tabular-nums">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by note, label or prefix" className="h-10 pl-10" aria-label="Search links" />
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : !data?.links.length ? (
          <div className="border-border text-muted-foreground rounded-3xl border border-dashed px-6 py-20 text-center text-sm">
            <Link2 className="mx-auto mb-3 size-8 opacity-50" />
            No {status === "all" ? "" : `${LABELS[status].toLowerCase()} `}links{q ? ` matching “${q}”` : ""}.
          </div>
        ) : (
          data.links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              noteTitle={`${link.noteTitle}${link.noteInTrash ? " (in trash)" : ""}`}
              busy={actions.busy}
              onRevoke={() => actions.revoke.mutate({ noteId: link.noteId, linkId: link.id })}
              onRegenerate={() => actions.regenerate.mutate({ noteId: link.noteId, linkId: link.id })}
              onExtend={(expiresAt) => actions.extend.mutate({ noteId: link.noteId, linkId: link.id, expiresAt })}
              onActivity={() => setActivity(link)}
            />
          ))
        )}
      </div>

      <ShareResultDialog result={result} onClose={() => setResult(null)} />
      <ActivitySheet noteId={activity?.noteId ?? ""} link={activity} onClose={() => setActivity(null)} />
    </div>
  );
}
