"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LayoutTemplate, Loader2, Save, Sparkles, Stamp, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { AiWriteDialog, TemplateDialog, readNoteFile } from "@/components/editor/create-helpers";
import { ColorPicker, PinToggle, TagInput, type NoteColor } from "@/components/editor/note-meta";
import { NoteEditor } from "@/components/editor/note-editor";
import { getTemplates, type Template } from "@/components/editor/templates";
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
import { Switch } from "@/components/ui/switch";
import { usePreferences } from "@/hooks/use-preferences";
import { ApiClientError, api, unwrap } from "@/lib/api-client";
import { scanForSensitiveData } from "@/lib/sensitive";
import { checkNote, checkShareSettings } from "@/lib/client-checks";

export function NewNoteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { prefs } = usePreferences();
  const fileRef = useRef<HTMLInputElement>(null);

  const initialTemplate = useMemo(() => getTemplates().find((t) => t.id === params.get("template")), [params]);
  const [title, setTitle] = useState(initialTemplate?.title ?? "");
  const [content, setContent] = useState(initialTemplate?.content ?? "");
  const [tags, setTags] = useState<string[]>(initialTemplate?.tags ?? []);
  const [color, setColor] = useState<NoteColor>("none");
  const [pinned, setPinned] = useState(false);
  const [shareNow, setShareNow] = useState(true);
  const [share, setShare] = useState<ShareDraft>(() => {
    const base = defaultShareDraft(prefs);
    return initialTemplate?.share ? { ...base, ...initialTemplate.share } : base;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<(ShareResult & { noteId: string }) | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(params.get("ai") === "1");
  const [confirmPublic, setConfirmPublic] = useState(false);

  const deferredText = useDeferredValue(`${title}\n${content}`);
  const findings = useMemo(() => scanForSensitiveData(deferredText), [deferredText]);
  const highRisk = findings.some((f) => f.severity === "high");
  const dirty = Boolean(title.trim() || content.trim()) && !result;

  // ?import=1 (from the dashboard/notes page) opens the file picker once the page is ready.
  useEffect(() => {
    if (params.get("import") === "1") fileRef.current?.click();
  }, [params]);

  // Warn before leaving with unsaved work (drafts are deliberately not stored in the browser).
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function applyTemplate(t: Template) {
    if ((title.trim() || content.trim()) && !window.confirm("Replace the current text with this template?")) return;
    setTitle(t.title);
    setContent(t.content);
    setTags(t.tags);
    if (t.share) setShare((s) => ({ ...s, ...t.share }));
    toast.success(`Template “${t.name}” applied`);
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const draft = await readNoteFile(file);
      setTitle(draft.title);
      setContent(draft.content);
      toast.success(`Imported “${file.name}”`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that file.");
    }
  }

  async function submit(opts: { skipPublicCheck?: boolean } = {}) {
    const payload = {
      title,
      content,
      tags,
      color,
      pinned,
      share: shareNow ? toShareSettings(share) : undefined,
    };
    const next = { ...checkNote(payload), ...(payload.share ? checkShareSettings(payload.share) : {}) };
    if (Object.keys(next).length) {
      setErrors(next);
      toast.error(Object.values(next)[0]);
      return;
    }
    if (shareNow && share.accessType === "public" && highRisk && prefs.warnPublicSensitive && !opts.skipPublicCheck) {
      setConfirmPublic(true);
      return;
    }

    setErrors({});
    setPending(true);
    try {
      const res = await unwrap(api.notes.$post({ json: payload }));
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["notes"] }), queryClient.invalidateQueries({ queryKey: ["tags"] }), queryClient.invalidateQueries({ queryKey: ["dashboard"] })]);
      if (res.link) {
        setResult({ shareUrl: res.shareUrl, accessKey: res.accessKey, link: res.link, noteId: res.note.id });
      } else {
        toast.success("Note saved privately. Share it any time.");
        router.push(`/notes/${res.note.id}`);
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrors(Object.fromEntries(Object.entries(error.fields).map(([k, v]) => [k.replace(/^share\./, ""), v])));
        toast.error(error.message);
      } else toast.error("Could not create the note.");
    } finally {
      setPending(false);
    }
  }

  const submitLabel = shareNow ? "Seal & create link" : "Save note";
  const SubmitIcon = shareNow ? Stamp : Save;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          void submit();
        }
      }}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/notes" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors">
            <ArrowLeft className="size-4" /> All notes
          </Link>
          <h1 className="font-display mt-2 text-4xl tracking-tight">New note</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setTemplatesOpen(true)}>
            <LayoutTemplate /> Templates
          </Button>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload /> Import
          </Button>
          <Button type="button" variant="outline" className="border-gold/40" onClick={() => setAiOpen(true)}>
            <Sparkles className="text-gold" /> Write with AI
          </Button>
          <input ref={fileRef} type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" className="hidden" onChange={(e) => void importFile(e.target.files?.[0])} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <NoteEditor
          title={title}
          content={content}
          onTitleChange={(v) => {
            setTitle(v);
            setErrors((e) => ({ ...e, title: "" }));
          }}
          onContentChange={(v) => {
            setContent(v);
            setErrors((e) => ({ ...e, content: "" }));
          }}
          errors={{ title: errors.title || undefined, content: errors.content || undefined }}
          autoFocus={!aiOpen}
          meta={
            <>
              <TagInput value={tags} onChange={setTags} title={title} content={content} />
              <ColorPicker value={color} onChange={setColor} />
              <PinToggle value={pinned} onChange={setPinned} />
            </>
          }
          status={<span>Not saved yet · Ctrl + Enter to save</span>}
        />

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="hairline bg-card rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl tracking-tight">Share settings</h2>
                <p className="text-muted-foreground mt-1 text-xs">{shareNow ? "A secure link is created with the note." : "The note stays private. Add links later."}</p>
              </div>
              <Switch checked={shareNow} onCheckedChange={setShareNow} aria-label="Create a share link now" />
            </div>
            {shareNow && (
              <div className="mt-5">
                <ShareSettings value={share} onChange={setShare} errors={errors} findings={findings} note={{ title, content }} />
              </div>
            )}
            <Button type="submit" variant="gold" size="xl" disabled={pending} className="mt-6 w-full">
              {pending ? <Loader2 className="animate-spin" /> : <SubmitIcon />} {submitLabel}
            </Button>
            <p className="text-muted-foreground mt-2 text-center text-[11px]">
              or press <kbd className="bg-muted rounded px-1 font-mono">Ctrl</kbd> + <kbd className="bg-muted rounded px-1 font-mono">Enter</kbd>
            </p>
          </div>
        </aside>
      </div>

      <TemplateDialog open={templatesOpen} onOpenChange={setTemplatesOpen} onPick={applyTemplate} />
      <AiWriteDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        onUse={(draft) => {
          if (draft.title) setTitle(draft.title);
          setContent(draft.content);
        }}
      />

      <AlertDialog open={confirmPublic} onOpenChange={setConfirmPublic}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">Share sensitive data publicly?</AlertDialogTitle>
            <AlertDialogDescription>
              This note seems to contain {findings.map((f) => f.label.toLowerCase()).join(", ")}. Anyone who gets the link — including a forwarded email or a
              chat preview — could read it. A key-protected link is much safer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShare((s) => ({ ...s, accessType: "password" }));
                toast.success("Switched to key-protected");
              }}
            >
              Use a key instead
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void submit({ skipPublicCheck: true })}>
              Share publicly anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareResultDialog
        result={result}
        closeLabel="Open note"
        onClose={() => {
          const id = result?.noteId;
          setResult(null);
          if (id) router.push(`/notes/${id}`);
        }}
      />
    </form>
  );
}
