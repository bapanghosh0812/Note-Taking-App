"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, CalendarClock, Eye, Link2, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { NoteEditor } from "@/components/editor/note-editor";
import { Markdown } from "@/components/markdown";
import { ShareResultDialog, type ShareResult } from "@/components/share/share-result-dialog";
import { ShareSettings, defaultShareDraft, toShareSettings, type ShareDraft } from "@/components/share/share-settings";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { noteKey, useNote } from "@/hooks/use-notes";
import { ApiClientError, api, errorMessage, unwrap } from "@/lib/api-client";
import { friendlyDate, relativeTime } from "@/lib/format";
import { scanForSensitiveData } from "@/lib/sensitive";
import { shareSettingsSchema, updateNoteSchema } from "@/lib/validation";
import { ActivitySheet } from "./activity-sheet";
import { LinkCard, type OwnerLink } from "./link-card";

type Prefs = Parameters<typeof defaultShareDraft>[0];

export function NoteDetail({ id, preferences }: { id: string; preferences: Prefs }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useNote(id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [editErrors, setEditErrors] = useState<{ title?: string; content?: string }>({});
  const [newLinkOpen, setNewLinkOpen] = useState(false);
  const [shareDraft, setShareDraft] = useState<ShareDraft>(() => defaultShareDraft(preferences));
  const [shareErrors, setShareErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ShareResult | null>(null);
  const [activityLink, setActivityLink] = useState<OwnerLink | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: noteKey(id) });
  const findings = useMemo(() => (data ? scanForSensitiveData(`${data.note.title}\n${data.note.content}`) : []), [data]);

  const save = useMutation({
    mutationFn: (patch: { title: string; content: string }) => unwrap(api.notes[":id"].$patch({ param: { id }, json: patch })),
    onSuccess: async () => {
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      setEditing(false);
      toast.success("Note saved — existing links now show the new version.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const createLink = useMutation({
    mutationFn: (settings: ReturnType<typeof toShareSettings>) =>
      unwrap(api.notes[":id"].links.$post({ param: { id }, json: settings })),
    onSuccess: async (res) => {
      setNewLinkOpen(false);
      setResult(res);
      setShareDraft(defaultShareDraft(preferences));
      await refresh();
    },
    onError: (e) => {
      if (e instanceof ApiClientError) setShareErrors(e.fields);
      toast.error(errorMessage(e));
    },
  });

  const linkAction = useMutation({
    mutationFn: async ({ linkId, action }: { linkId: string; action: "revoke" | "regenerate" }) =>
      action === "revoke"
        ? { action, ...(await unwrap(api.notes[":id"].links[":linkId"].revoke.$post({ param: { id, linkId } }))) }
        : { action, ...(await unwrap(api.notes[":id"].links[":linkId"]["regenerate-key"].$post({ param: { id, linkId } }))) },
    onSuccess: async (res) => {
      if (res.action === "revoke") toast.success("Link revoked. It stopped working instantly.");
      else if ("accessKey" in res) setResult({ accessKey: res.accessKey, link: res.link, keyOnly: true });
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const revokeAll = useMutation({
    mutationFn: () => unwrap(api.notes[":id"].links["revoke-all"].$post({ param: { id } })),
    onSuccess: async (res) => {
      toast.success(res.revoked ? `Revoked ${res.revoked} link${res.revoked === 1 ? "" : "s"}.` : "No active links to revoke.");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => unwrap(api.notes[":id"].$delete({ param: { id } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note deleted. Every share link to it is now dead.");
      router.replace("/notes");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    const missing = error instanceof ApiClientError && error.status === 404;
    return (
      <div className="hairline bg-card mx-auto max-w-lg rounded-3xl p-10 text-center">
        <p className="font-display text-3xl">{missing ? "Note not found" : "Couldn’t load this note"}</p>
        <p className="text-muted-foreground mt-2 text-sm">
          {missing ? "It may have been deleted, or it belongs to a different account." : errorMessage(error)}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/notes">Back to notes</Link>
        </Button>
      </div>
    );
  }

  const { note, links } = data;
  const activeCount = links.filter((l) => l.status === "active" || l.status === "locked").length;
  const totalViews = links.reduce((n, l) => n + l.viewCount, 0);
  const lastViewed = links.map((l) => l.lastViewedAt).filter(Boolean).sort().pop();

  function startEdit() {
    setDraft({ title: note.title, content: note.content });
    setEditErrors({});
    setEditing(true);
  }

  function submitEdit() {
    const parsed = updateNoteSchema.safeParse(draft);
    if (!parsed.success) {
      const errs: { title?: string; content?: string } = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as "title" | "content"] ??= issue.message;
      setEditErrors(errs);
      return;
    }
    save.mutate(draft);
  }

  function submitNewLink() {
    const settings = toShareSettings(shareDraft);
    const parsed = shareSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setShareErrors(errs);
      return;
    }
    setShareErrors({});
    createLink.mutate(settings);
  }

  return (
    <div>
      <Link href="/notes" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors">
        <ArrowLeft className="size-4" /> All notes
      </Link>

      {/* Header */}
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {!editing && <h1 className="font-display text-4xl leading-tight tracking-tight break-words sm:text-5xl">{note.title}</h1>}
        {editing && <h1 className="font-display text-4xl tracking-tight">Editing note</h1>}
        <div className="flex shrink-0 gap-2">
          {editing ? (
            <>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={save.isPending}>
                <X /> Cancel
              </Button>
              <Button variant="gold" onClick={submitEdit} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEdit}>
                <Pencil /> Edit
              </Button>
              <Button variant="outline" onClick={() => setConfirmDelete(true)} className="hover:border-destructive/40 hover:text-destructive" aria-label="Delete note">
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      </div>
      {!editing && (
        <p className="text-muted-foreground mt-2 text-sm">
          Created {friendlyDate(note.createdAt)}
          {note.updatedAt !== note.createdAt && ` · Edited ${relativeTime(note.updatedAt)}`}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Content */}
        <div className="min-w-0">
          {editing ? (
            <NoteEditor
              title={draft.title}
              content={draft.content}
              onTitleChange={(v) => setDraft((d) => ({ ...d, title: v }))}
              onContentChange={(v) => setDraft((d) => ({ ...d, content: v }))}
              errors={editErrors}
            />
          ) : (
            <article className="hairline bg-card rounded-2xl p-6 sm:p-8">
              <Markdown>{note.content}</Markdown>
            </article>
          )}
        </div>

        {/* Stats */}
        <aside className="space-y-3">
          {[
            { icon: Eye, label: "Total views", value: totalViews.toLocaleString() },
            { icon: Link2, label: "Active links", value: `${activeCount} of ${links.length}` },
            { icon: CalendarClock, label: "Last opened", value: lastViewed ? relativeTime(lastViewed) : "Never" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="hairline bg-card flex items-center gap-3 rounded-2xl p-4">
              <span className="bg-gold-soft text-gold grid size-10 place-items-center rounded-xl">
                <Icon className="size-4.5" />
              </span>
              <div>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-lg leading-tight font-semibold tabular-nums">{value}</p>
              </div>
            </div>
          ))}
          <p className="text-muted-foreground px-1 text-[11px] leading-relaxed">
            Counts update live. A view is counted only for a successful public open or a correct key — never for wrong keys or dead links.
          </p>
        </aside>
      </div>

      {/* Share links */}
      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl tracking-tight">Share links</h2>
            <p className="text-muted-foreground mt-1 text-sm">Each link has its own rules. Revoke one without affecting the others.</p>
          </div>
          <div className="flex gap-2">
            {activeCount > 1 && (
              <Button variant="outline" onClick={() => setConfirmRevokeAll(true)} disabled={revokeAll.isPending}>
                <Ban /> Revoke all
              </Button>
            )}
            <Button variant="gold" onClick={() => setNewLinkOpen(true)}>
              <Plus /> New link
            </Button>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {links.length === 0 ? (
            <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
              No share links yet. Create one to send this note.
            </div>
          ) : (
            links.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                busy={linkAction.isPending}
                onRevoke={() => linkAction.mutate({ linkId: link.id, action: "revoke" })}
                onRegenerate={() => linkAction.mutate({ linkId: link.id, action: "regenerate" })}
                onActivity={() => setActivityLink(link)}
              />
            ))
          )}
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          For your security, full link addresses and keys are shown only once, when they are created. Lost one? Revoke it and create a new link.
        </p>
      </section>

      {/* New link dialog */}
      <Dialog open={newLinkOpen} onOpenChange={setNewLinkOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-normal">New share link</DialogTitle>
            <DialogDescription>A fresh, independent link for “{note.title}”.</DialogDescription>
          </DialogHeader>
          <ShareSettings value={shareDraft} onChange={setShareDraft} errors={shareErrors} findings={findings} />
          <Button variant="gold" size="xl" onClick={submitNewLink} disabled={createLink.isPending}>
            {createLink.isPending ? <Loader2 className="animate-spin" /> : <Link2 />} Create link
          </Button>
        </DialogContent>
      </Dialog>

      <ShareResultDialog result={result} onClose={() => setResult(null)} />
      <ActivitySheet noteId={id} link={activityLink} onClose={() => setActivityLink(null)} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">Delete this note forever?</AlertDialogTitle>
            <AlertDialogDescription>
              The note, its {links.length} share link{links.length === 1 ? "" : "s"} and all activity will be permanently removed. Anyone holding a link will see “invalid link”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep note</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRevokeAll} onOpenChange={setConfirmRevokeAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">Revoke every link?</AlertDialogTitle>
            <AlertDialogDescription>All {activeCount} active links stop working immediately. The note itself is kept.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => revokeAll.mutate()}>
              Revoke all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
