"use client";

import { Archive, ArchiveRestore, Copy, Eye, Link2, MoreHorizontal, Pin, PinOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { friendlyDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNoteActions } from "./note-actions";

export type NoteSummary = {
  id: string;
  title: string;
  excerpt: string;
  words: number;
  pinned: boolean;
  color: string | null;
  tags: string[];
  archivedAt: string | null;
  updatedAt: string;
  links: number;
  activeLinks: number;
  views: number;
};

export function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-[\]()!|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function Menu({ note }: { note: NoteSummary }) {
  const { patch, trash, duplicate } = useNoteActions();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${note.title}`} onClick={(e) => e.preventDefault()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => patch.mutate({ id: note.id, pinned: !note.pinned })}>
          {note.pinned ? <PinOff /> : <Pin />} {note.pinned ? "Unpin" : "Pin to top"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => duplicate.mutate(note.id)}>
          <Copy /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => patch.mutate({ id: note.id, archived: !note.archivedAt })}>
          {note.archivedAt ? <ArchiveRestore /> : <Archive />} {note.archivedAt ? "Unarchive" : "Archive"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => trash.mutate(note.id)}>
          <Trash2 /> Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NoteCard({ note, layout }: { note: NoteSummary; layout: "grid" | "list" }) {
  const excerpt = stripMarkdown(note.excerpt) || "Empty note";

  if (layout === "list") {
    return (
      <div data-note-color={note.color ?? undefined} className={cn("group hairline bg-card relative flex items-center gap-4 rounded-2xl px-4 py-3.5", note.color && "note-tinted")}>
        {note.color && <span className="absolute inset-y-3 left-0 w-1 rounded-r bg-[var(--note-tint)]" />}
        <Link href={`/notes/${note.id}`} className="min-w-0 flex-1 after:absolute after:inset-0">
          <span className="flex items-center gap-2">
            {note.pinned && <Pin className="text-gold size-3.5 shrink-0" />}
            <span className="truncate font-medium">{note.title}</span>
            {note.activeLinks > 0 && <span className="bg-success size-1.5 shrink-0 rounded-full" title="Has active share links" />}
          </span>
          <span className="text-muted-foreground mt-0.5 block truncate text-sm">{excerpt}</span>
        </Link>
        <div className="text-muted-foreground hidden shrink-0 items-center gap-4 text-xs md:flex">
          {note.tags.slice(0, 2).map((t) => (
            <span key={t} className="bg-muted rounded-full px-2 py-0.5">
              #{t}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <Link2 className="size-3.5" /> {note.links}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" /> {note.views}
          </span>
          <span className="w-32 text-right">
            <LocalTime>{() => friendlyDate(note.updatedAt)}</LocalTime>
          </span>
        </div>
        <div className="relative z-10">
          <Menu note={note} />
        </div>
      </div>
    );
  }

  return (
    <div
      data-note-color={note.color ?? undefined}
      className={cn(
        "group hairline bg-card hover:ring-gold/40 relative flex h-full min-h-52 flex-col overflow-hidden rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:ring-1",
        note.color && "note-tinted",
      )}
    >
      {note.color && <span className="absolute inset-x-0 top-0 h-1 bg-[var(--note-tint)]" />}
      <div className="flex items-start justify-between gap-2">
        <Link href={`/notes/${note.id}`} className="min-w-0 after:absolute after:inset-0">
          <h2 className="font-display line-clamp-2 text-2xl leading-tight tracking-tight">{note.title}</h2>
        </Link>
        <div className="relative z-10 -mt-1 -mr-2 flex shrink-0 items-center">
          {note.pinned && <Pin className="text-gold size-3.5" aria-label="Pinned" />}
          <div className="opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
            <Menu note={note} />
          </div>
        </div>
      </div>
      <p className="text-muted-foreground mt-2 line-clamp-3 flex-1 text-sm leading-relaxed">{excerpt}</p>
      {note.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {note.tags.slice(0, 3).map((t) => (
            <span key={t} className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">
              #{t}
            </span>
          ))}
          {note.tags.length > 3 && <span className="text-muted-foreground text-[11px]">+{note.tags.length - 3}</span>}
        </div>
      )}
      <div className="text-muted-foreground mt-4 flex items-center gap-3 text-xs">
        <span className="min-h-4">
          <LocalTime>{() => friendlyDate(note.updatedAt)}</LocalTime>
        </span>
        {note.activeLinks > 0 && <span className="bg-success/12 text-success ring-success/25 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset">Live</span>}
        <span className="ml-auto inline-flex items-center gap-1" title="Share links">
          <Link2 className="size-3.5" /> {note.links}
        </span>
        <span className="inline-flex items-center gap-1" title="Total views">
          <Eye className="size-3.5" /> {note.views}
        </span>
      </div>
    </div>
  );
}
