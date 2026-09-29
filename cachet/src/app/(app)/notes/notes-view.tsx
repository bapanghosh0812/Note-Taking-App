"use client";

import { Eye, FilePlus2, Link2, Search, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { SealMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotes } from "@/hooks/use-notes";
import { friendlyDate, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-[\]()!|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function NotesView({ firstName }: { firstName: string }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const { data, isLoading, isError, refetch, isFetching } = useNotes(deferred);
  const notes = data?.notes ?? [];

  const totals = notes.reduce(
    (acc, n) => ({ active: acc.active + n.activeLinks, views: acc.views + n.views }),
    { active: 0, views: 0 },
  );

  return (
    <div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Your vault</p>
          <h1 className="font-display mt-2 text-5xl tracking-tight">
            Good to see you, <em className="text-gold-gradient">{firstName}</em>
          </h1>
          {!deferred && notes.length > 0 && (
            <p className="text-muted-foreground mt-3 text-sm">
              {plural(notes.length, "note")} · {plural(totals.active, "active link")} · {plural(totals.views, "view")}
            </p>
          )}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your notes"
            className="pl-10"
            aria-label="Search notes"
            maxLength={100}
          />
          {isFetching && deferred && <div className="shimmer absolute inset-x-3 bottom-0 h-px" />}
        </div>
      </div>

      <div className="mt-10">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="hairline bg-card rounded-2xl p-10 text-center">
            <p className="font-display text-2xl">We couldn’t load your notes.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : notes.length === 0 && deferred ? (
          <div className="text-muted-foreground py-20 text-center">
            No notes match “<span className="text-foreground">{deferred}</span>”.
          </div>
        ) : notes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NewNoteTile />
            {notes.map((note, i) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.35, ease: "easeOut" }}
              >
                <Link
                  href={`/notes/${note.id}`}
                  className="group hairline bg-card hover:ring-gold/40 relative flex h-full min-h-48 flex-col rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:ring-1"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display line-clamp-2 text-2xl leading-tight tracking-tight">{note.title}</h2>
                    {note.activeLinks > 0 && (
                      <span className="bg-success/12 text-success ring-success/25 mt-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset">
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-2 line-clamp-3 flex-1 text-sm leading-relaxed">
                    {stripMarkdown(note.excerpt) || "Empty note"}
                  </p>
                  <div className="text-muted-foreground mt-4 flex items-center gap-4 text-xs">
                    <span>{friendlyDate(note.updatedAt)}</span>
                    <span className="ml-auto inline-flex items-center gap-1" title="Share links">
                      <Link2 className="size-3.5" /> {note.links}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Total views">
                      <Eye className="size-3.5" /> {note.views}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewNoteTile() {
  return (
    <Link
      href="/notes/new"
      className={cn(
        "group border-border hover:border-gold/60 hover:bg-gold-soft/40 flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-5 text-center transition-colors",
      )}
    >
      <span className="bg-gold-soft text-gold ring-gold/30 grid size-12 place-items-center rounded-full ring-1 transition-transform group-hover:scale-110">
        <FilePlus2 className="size-5" />
      </span>
      <span className="font-display text-xl">Seal a new note</span>
      <span className="text-muted-foreground text-xs">Write, choose who can open it, share.</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="hairline bg-card relative overflow-hidden rounded-3xl px-6 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(30rem_18rem_at_50%_0%,var(--gold-soft),transparent_70%)]" />
      <SealMark className="animate-float relative mx-auto size-24" />
      <h2 className="font-display relative mt-6 text-4xl tracking-tight">Your vault is empty</h2>
      <p className="text-muted-foreground relative mx-auto mt-3 max-w-md text-sm leading-relaxed">
        Write your first note and share it with a link that expires on your terms — once, by the hour, or
        behind a key only you hand out.
      </p>
      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="gold" size="xl">
          <Link href="/notes/new">
            <FilePlus2 /> Write your first note
          </Link>
        </Button>
      </div>
      <p className="text-muted-foreground relative mt-6 inline-flex items-center gap-1.5 text-xs">
        <Sparkles className="text-gold size-3.5" /> Tip: press <kbd className="bg-muted rounded px-1.5 font-mono">Ctrl K</kbd> anywhere to search
      </p>
    </div>
  );
}
