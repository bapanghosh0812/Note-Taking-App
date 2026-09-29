"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Ban,
  CalendarClock,
  Check,
  Copy,
  Download,
  Eye,
  FileDown,
  History,
  Link2,
  Loader2,
  MoreHorizontal,
  Plus,
  Printer,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "@/lib/toast";
import { useShell } from "@/components/app-shell/shell-context";
import { ColorPicker, PinToggle, TagInput, type NoteColor } from "@/components/editor/note-meta";
import { NoteEditor } from "@/components/editor/note-editor";
import { LocalTime } from "@/components/local-time";
import { Markdown } from "@/components/lazy-markdown";
import { useNoteActions } from "@/components/notes/note-actions";
import { useLinkActions } from "@/components/share/link-actions";
import { LinkCard, type OwnerLink } from "@/components/share/link-card";
import type { ShareResult } from "@/components/share/share-result-dialog";
import { ShareSettings, defaultShareDraft, toShareSettings, type ShareDraft } from "@/components/share/share-settings";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { noteKey, useNote } from "@/hooks/use-notes";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import { usePreferences } from "@/hooks/use-preferences";
import { ApiClientError, api, errorMessage, unwrap } from "@/lib/api-client";
import { friendlyDate, relativeTime } from "@/lib/format";
import { downloadText, slugify, toMarkdown } from "@/lib/note-export";
import { scanForSensitiveData } from "@/lib/sensitive";
import { checkNote, checkShareSettings } from "@/lib/client-checks";

type Draft = {
  title: string;
  content: string;
  tags: string[];
  color: NoteColor;
  pinned: boolean;
};
type SaveState = "saved" | "dirty" | "saving" | "error";

const sameDraft = (a: Draft, b: Draft) => a.title === b.title && a.content === b.content && a.color === b.color && a.pinned === b.pinned && a.tags.join("|") === b.tags.join("|");

// Opened on demand, so they are downloaded on first use rather than with the editor.
const ShareResultDialog = dynamic(() => import("@/components/share/share-result-dialog").then((m) => m.ShareResultDialog), { ssr: false });
const ActivitySheet = dynamic(() => import("@/components/share/activity-sheet").then((m) => m.ActivitySheet), { ssr: false });
const VersionSheet = dynamic(() => import("@/components/editor/version-sheet").then((m) => m.VersionSheet), { ssr: false });

export function NoteDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useNote(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }
  if (error || !data) {
    const missing = error instanceof ApiClientError && error.status === 404;
    return (
      <div className="hairline bg-card mx-auto max-w-lg rounded-3xl p-10 text-center">
        <p className="font-display text-3xl">{missing ? "Note not found" : "Couldn’t load this note"}</p>
        <p className="text-muted-foreground mt-2 text-sm">{missing ? "It may have been deleted, or it belongs to a different account." : errorMessage(error)}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/notes">Back to notes</Link>
        </Button>
      </div>
    );
  }
  // Keyed by id: the editor state is created once from the first load, so the 5-second
  // background refresh (live view counts) never overwrites what the user is typing.
  return <NoteWorkspace key={id} id={id} data={data} />;
}

type NoteData = NonNullable<ReturnType<typeof useNote>["data"]>;

function NoteWorkspace({ id, data }: { id: string; data: NoteData }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { prefs } = usePreferences();
  const { openAssistant } = useShell();
  const noteActions = useNoteActions();
  const [result, setResult] = useState<ShareResult | null>(null);
  const linkActions = useLinkActions(setResult);

  const initial: Draft = {
    title: data.note.title,
    content: data.note.content,
    tags: data.note.tags,
    color: (data.note.color ?? "none") as NoteColor,
    pinned: data.note.pinned,
  };
  const [draft, setDraft] = useState<Draft>(initial);
  const [savedDraft, setSavedDraft] = useState<Draft>(initial);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState(data.note.updatedAt);
  const [editErrors, setEditErrors] = useState<{
    title?: string;
    content?: string;
  }>({});

  const [newLinkOpen, setNewLinkOpen] = useState(false);
  const [shareDraft, setShareDraft] = useState<ShareDraft>(() => defaultShareDraft(prefs));
  const [shareErrors, setShareErrors] = useState<Record<string, string>>({});
  const [activityLink, setActivityLink] = useState<OwnerLink | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyLoaded = useOpenedOnce(historyOpen);
  const activityLoaded = useOpenedOnce(activityLink !== null);
  const [printing, setPrinting] = useState(false);

  // The print copy (rendered Markdown) is only built when the user prints — Ctrl+P
  // included — so it costs nothing on page load.
  useEffect(() => {
    const onBeforePrint = () => flushSync(() => setPrinting(true));
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, []);
  const [confirm, setConfirm] = useState<"trash" | "revoke-all" | null>(null);

  const dirty = !sameDraft(draft, savedDraft);

  const save = useCallback(async () => {
    const prev = savedDraft;
    if (sameDraft(draft, prev)) return;
    const errs = checkNote({ title: draft.title, content: draft.content });
    if (Object.keys(errs).length) {
      setEditErrors(errs);
      setSaveState("error");
      return;
    }
    setEditErrors({});
    setSaveState("saving");
    const snapshot = draft;
    try {
      const res = await unwrap(
        api.notes[":id"].$patch({
          param: { id },
          json: {
            ...(snapshot.title !== prev.title ? { title: snapshot.title } : {}),
            ...(snapshot.content !== prev.content ? { content: snapshot.content } : {}),
            ...(snapshot.tags.join("|") !== prev.tags.join("|") ? { tags: snapshot.tags } : {}),
            ...(snapshot.color !== prev.color ? { color: snapshot.color } : {}),
            ...(snapshot.pinned !== prev.pinned ? { pinned: snapshot.pinned } : {}),
          },
        }),
      );
      setSavedDraft(snapshot);
      setSavedAt(res.note.updatedAt);
      setSaveState("saved");
      void queryClient.invalidateQueries({ queryKey: ["notes"] });
      void queryClient.invalidateQueries({ queryKey: ["tags"] });
    } catch (e) {
      setSaveState("error");
      if (e instanceof ApiClientError && Object.keys(e.fields).length) setEditErrors(e.fields);
      toast.error(errorMessage(e));
    }
  }, [draft, savedDraft, id, queryClient]);

  // Autosave 1.2 s after the last change.
  useEffect(() => {
    if (!dirty || !prefs.autosave) return;
    const t = setTimeout(() => void save(), 1200);
    return () => clearTimeout(t);
  }, [dirty, prefs.autosave, save]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const createLink = useMutation({
    mutationFn: (settings: ReturnType<typeof toShareSettings>) => unwrap(api.notes[":id"].links.$post({ param: { id }, json: settings })),
    onSuccess: async (res) => {
      setNewLinkOpen(false);
      setResult(res);
      setShareDraft(defaultShareDraft(prefs));
      await queryClient.invalidateQueries({ queryKey: noteKey(id) });
    },
    onError: (e) => {
      if (e instanceof ApiClientError) setShareErrors(e.fields);
      toast.error(errorMessage(e));
    },
  });

  const revokeAll = useMutation({
    mutationFn: () => unwrap(api.notes[":id"].links["revoke-all"].$post({ param: { id } })),
    onSuccess: async (res) => {
      toast.success(res.revoked ? `Revoked ${res.revoked} link${res.revoked === 1 ? "" : "s"}.` : "No active links to revoke.");
      await queryClient.invalidateQueries({ queryKey: noteKey(id) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const findings = useMemo(() => scanForSensitiveData(`${draft.title}\n${draft.content}`), [draft.title, draft.content]);

  const { note, links } = data;
  const inTrash = Boolean(note.deletedAt);
  const activeCount = links.filter((l) => l.status === "active" || l.status === "locked").length;
  const totalViews = links.reduce((n, l) => n + l.viewCount, 0);
  const lastViewed = links
    .map((l) => l.lastViewedAt)
    .filter(Boolean)
    .sort()
    .pop();
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const effectiveState: SaveState = saveState === "saved" && dirty ? "dirty" : saveState;
  const statusLabel = {
    saved: (
      <span className="inline-flex items-center gap-1">
        <Check className="text-success size-3.5" /> Saved <LocalTime>{() => relativeTime(savedAt)}</LocalTime>
      </span>
    ),
    dirty: prefs.autosave ? "Unsaved changes…" : "Unsaved changes — press Ctrl + S",
    saving: (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    ),
    error: <span className="text-destructive">Not saved — fix the error or try again</span>,
  }[effectiveState];

  function submitNewLink() {
    const settings = toShareSettings(shareDraft);
    const errs = checkShareSettings(settings);
    if (Object.keys(errs).length) {
      setShareErrors(errs);
      return;
    }
    setShareErrors({});
    createLink.mutate(settings);
  }

  return (
    <div>
      {/* Printable version (hidden on screen). */}
      {printing && (
        <article className="hidden print:block">
          <h1 className="font-display mb-6 text-4xl">{draft.title}</h1>
          <Markdown>{draft.content}</Markdown>
        </article>
      )}

      <div className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm" aria-label="Breadcrumb">
            <Link href="/notes" className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors">
              <ArrowLeft className="size-4" /> Notes
            </Link>
            <span>/</span>
            <span className="text-foreground truncate">{draft.title || "Untitled"}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            {!inTrash && (
              <>
                {(!prefs.autosave || effectiveState === "error") && effectiveState !== "saved" && (
                  <Button variant="gold" onClick={() => void save()} disabled={effectiveState === "saving"}>
                    <Save /> Save
                  </Button>
                )}
                <Button variant="outline" className="border-gold/40" onClick={() => openAssistant({ noteId: id, noteTitle: draft.title })}>
                  <Sparkles className="text-gold" /> Ask AI
                </Button>
                <Button variant="outline" onClick={() => setHistoryOpen(true)}>
                  <History /> History
                </Button>
                <Button variant="gold" onClick={() => setNewLinkOpen(true)}>
                  <Link2 /> Share
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {!inTrash && (
                  <DropdownMenuItem onSelect={() => noteActions.duplicate.mutate(id)}>
                    <Copy /> Duplicate
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => downloadText(`${slugify(draft.title)}.md`, toMarkdown(draft))}>
                  <FileDown /> Download as Markdown
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    await navigator.clipboard.writeText(toMarkdown(draft));
                    toast.success("Copied as Markdown");
                  }}
                >
                  <Download /> Copy as Markdown
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    await import("@/components/markdown"); // warm the chunk so the print copy is ready
                    setPrinting(true);
                    setTimeout(() => window.print(), 150);
                  }}
                >
                  <Printer /> Print / save as PDF
                </DropdownMenuItem>
                {!inTrash && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() =>
                        noteActions.patch.mutate({
                          id,
                          archived: !note.archivedAt,
                        })
                      }
                    >
                      {note.archivedAt ? <ArchiveRestore /> : <Archive />} {note.archivedAt ? "Unarchive" : "Archive"}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("trash")}>
                      <Trash2 /> Move to trash
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {inTrash && (
          <div className="border-destructive/30 bg-destructive/5 mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm">
            <Trash2 className="text-destructive size-4" /> This note is in the trash and is read-only. Its links were revoked.
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => noteActions.restore.mutate(id)}>
              <ArchiveRestore /> Restore
            </Button>
          </div>
        )}
        {note.archivedAt && !inTrash && (
          <div className="border-border bg-muted/40 mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm">
            <Archive className="size-4" /> Archived <LocalTime>{() => relativeTime(note.archivedAt!)}</LocalTime> — hidden from All notes. Links keep working.
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => noteActions.patch.mutate({ id, archived: false })}>
              Unarchive
            </Button>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <NoteEditor
            title={draft.title}
            content={draft.content}
            onTitleChange={(title) => update({ title })}
            onContentChange={(content) => update({ content })}
            errors={editErrors}
            readOnly={inTrash}
            onSave={() => void save()}
            status={inTrash ? "Read-only" : statusLabel}
            meta={
              !inTrash && (
                <>
                  <TagInput value={draft.tags} onChange={(tags) => update({ tags })} title={draft.title} content={draft.content} />
                  <ColorPicker value={draft.color} onChange={(color) => update({ color })} />
                  <PinToggle value={draft.pinned} onChange={(pinned) => update({ pinned })} />
                </>
              )
            }
          />

          <aside className="space-y-3">
            {[
              {
                icon: Eye,
                label: "Total views",
                value: totalViews.toLocaleString(),
              },
              {
                icon: Link2,
                label: "Active links",
                value: `${activeCount} of ${links.length}`,
              },
              {
                icon: CalendarClock,
                label: "Last opened",
                value: lastViewed ? <LocalTime>{() => relativeTime(lastViewed)}</LocalTime> : "Never",
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="hairline bg-card flex items-center gap-3 rounded-2xl p-4">
                <span className="bg-gold-soft text-gold grid size-10 place-items-center rounded-xl">
                  <Icon className="size-[18px]" />
                </span>
                <div>
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <p className="text-lg leading-tight font-semibold tabular-nums">{value}</p>
                </div>
              </div>
            ))}
            <div className="text-muted-foreground space-y-1 px-1 text-xs">
              <p>
                Created <LocalTime>{() => friendlyDate(note.createdAt)}</LocalTime>
              </p>
              <p className="pt-2 leading-relaxed">Counts update live. A view is counted only for a successful public open or a correct key — never for wrong keys or dead links.</p>
            </div>
          </aside>
        </div>

        {/* Share links */}
        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl tracking-tight">Share links</h2>
              <p className="text-muted-foreground mt-1 text-sm">Each link has its own rules. Revoke one without affecting the others.</p>
            </div>
            {!inTrash && (
              <div className="flex gap-2">
                {activeCount > 1 && (
                  <Button variant="outline" onClick={() => setConfirm("revoke-all")} disabled={revokeAll.isPending}>
                    <Ban /> Revoke all
                  </Button>
                )}
                <Button variant="gold" onClick={() => setNewLinkOpen(true)}>
                  <Plus /> New link
                </Button>
              </div>
            )}
          </div>
          <div className="mt-5 space-y-3">
            {links.length === 0 ? (
              <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">This note is private. Create a link to share it.</div>
            ) : (
              links.map((link) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  busy={linkActions.busy}
                  onRevoke={() => linkActions.revoke.mutate({ noteId: id, linkId: link.id })}
                  onRegenerate={() =>
                    linkActions.regenerate.mutate({
                      noteId: id,
                      linkId: link.id,
                    })
                  }
                  onExtend={(expiresAt) =>
                    linkActions.extend.mutate({
                      noteId: id,
                      linkId: link.id,
                      expiresAt,
                    })
                  }
                  onActivity={() => setActivityLink(link)}
                />
              ))
            )}
          </div>
          <p className="text-muted-foreground mt-4 text-xs">For your security, full link addresses and keys are shown only once, when they are created. Lost one? Revoke it and create a new link.</p>
        </section>
      </div>

      <Dialog open={newLinkOpen} onOpenChange={setNewLinkOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-normal">New share link</DialogTitle>
            <DialogDescription>A fresh, independent link for “{draft.title}”.</DialogDescription>
          </DialogHeader>
          <ShareSettings value={shareDraft} onChange={setShareDraft} errors={shareErrors} findings={findings} note={{ title: draft.title, content: draft.content }} />
          <Button variant="gold" size="xl" onClick={submitNewLink} disabled={createLink.isPending}>
            {createLink.isPending ? <Loader2 className="animate-spin" /> : <Link2 />} Create link
          </Button>
        </DialogContent>
      </Dialog>

      {result && <ShareResultDialog result={result} onClose={() => setResult(null)} />}
      {activityLoaded && <ActivitySheet noteId={id} link={activityLink} onClose={() => setActivityLink(null)} />}
      {historyLoaded && (
        <VersionSheet
          noteId={id}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          onRestored={(restored) => {
            const next = {
              ...draft,
              title: restored.title,
              content: restored.content,
            };
            setSavedDraft(next);
            setDraft(next);
            setSaveState("saved");
            setSavedAt(new Date().toISOString());
          }}
        />
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">{confirm === "trash" ? "Move this note to trash?" : "Revoke every link?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "trash"
                ? `${activeCount ? `All ${activeCount} active link${activeCount === 1 ? "" : "s"} will stop working immediately. ` : ""}You can restore the note from Trash for 30 days.`
                : `All ${activeCount} active links stop working immediately. The note itself is kept.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirm === "trash")
                  noteActions.trash.mutate(id, {
                    onSuccess: () => router.push("/notes"),
                  });
                else revokeAll.mutate();
              }}
            >
              {confirm === "trash" ? "Move to trash" : "Revoke all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
