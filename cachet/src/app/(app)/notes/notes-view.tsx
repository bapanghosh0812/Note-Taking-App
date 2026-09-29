"use client";

import { FilePlus2, Hash, LayoutGrid, List, Search, Sparkles, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { SealMark } from "@/components/brand/logo";
import { NoteCard } from "@/components/notes/note-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotes, type NotesQuery } from "@/hooks/use-notes";
import { usePreferences } from "@/hooks/use-preferences";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

const VIEWS = [
  { id: "all", label: "All" },
  { id: "pinned", label: "Pinned" },
  { id: "shared", label: "Shared" },
  { id: "archived", label: "Archive" },
] as const;

const TITLES: Record<string, { title: string; empty: string }> = {
  all: { title: "All notes", empty: "Write your first note and share it on your terms." },
  pinned: { title: "Pinned", empty: "Pin important notes to keep them at the top." },
  shared: { title: "Shared", empty: "Notes with an active share link appear here." },
  archived: { title: "Archive", empty: "Archived notes are hidden from All notes but keep their links." },
};

export function NotesView() {
  const router = useRouter();
  const params = useSearchParams();
  const view = (params.get("view") as NotesQuery["view"]) ?? "all";
  const tag = params.get("tag") ?? undefined;
  const { prefs, update } = usePreferences();
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim());
  const { data, isLoading, isError, refetch, isFetching } = useNotes({ q, view, tag, sort: prefs.notesSort });
  const notes = data?.notes ?? [];
  const meta = TITLES[view ?? "all"] ?? TITLES.all!;

  const setParam = (key: string, value?: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/notes${next.size ? `?${next}` : ""}`);
  };

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Your vault</p>
          <h1 className="font-display mt-2 text-5xl tracking-tight">{tag ? `#${tag}` : meta.title}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {isLoading ? "Loading…" : `${plural(notes.length, "note")}${q ? ` matching “${q}”` : ""}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="lg">
            <Link href="/notes/new?import=1"><Upload /> Import</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/notes/new?ai=1"><Sparkles className="text-gold" /> Write with AI</Link>
          </Button>
          <Button asChild variant="gold" size="lg">
            <Link href="/notes/new"><FilePlus2 /> New note</Link>
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="bg-muted inline-flex w-fit rounded-xl p-1" role="tablist" aria-label="Filter notes">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setParam("view", v.id === "all" ? undefined : v.id)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm transition-all",
                view === v.id ? "bg-card text-foreground font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {tag && (
          <button onClick={() => setParam("tag")} className="bg-gold-soft text-foreground inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm">
            <Hash className="text-gold size-3.5" /> {tag} <X className="size-3.5" />
          </button>
        )}
        <div className="flex flex-1 items-center gap-2 lg:justify-end">
          <div className="relative min-w-0 flex-1 lg:max-w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in these notes" className="h-10 pl-10" aria-label="Search notes" maxLength={100} />
            {isFetching && q && <div className="shimmer absolute inset-x-3 bottom-0 h-px" />}
          </div>
          <Select value={prefs.notesSort} onValueChange={(v) => update({ notesSort: v as typeof prefs.notesSort }, { silent: true })}>
            <SelectTrigger className="h-10 w-40 rounded-xl" aria-label="Sort notes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Last edited</SelectItem>
              <SelectItem value="created">Date created</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
            </SelectContent>
          </Select>
          <div className="bg-muted flex rounded-xl p-1">
            {(["grid", "list"] as const).map((layout) => (
              <button
                key={layout}
                type="button"
                onClick={() => update({ notesView: layout }, { silent: true })}
                aria-label={`${layout} view`}
                aria-pressed={prefs.notesView === layout}
                className={cn("rounded-lg p-1.5 transition-all", prefs.notesView === layout ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {layout === "grid" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="hairline bg-card rounded-2xl p-10 text-center">
            <p className="font-display text-2xl">We couldn’t load your notes.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : notes.length === 0 ? (
          <div className="hairline bg-card relative overflow-hidden rounded-3xl px-6 py-16 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(30rem_18rem_at_50%_0%,var(--gold-soft),transparent_70%)]" />
            <SealMark className="animate-float relative mx-auto size-20" />
            <h2 className="font-display relative mt-6 text-3xl tracking-tight">{q ? "No matches" : "Nothing here yet"}</h2>
            <p className="text-muted-foreground relative mx-auto mt-2 max-w-md text-sm">{q ? `No notes match “${q}”.` : meta.empty}</p>
            {!q && view === "all" && (
              <Button asChild variant="gold" size="xl" className="relative mt-8">
                <Link href="/notes/new"><FilePlus2 /> Write your first note</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className={prefs.notesView === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2"}>
            {notes.map((note, i) => (
              <div key={note.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <NoteCard note={note} layout={prefs.notesView} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
