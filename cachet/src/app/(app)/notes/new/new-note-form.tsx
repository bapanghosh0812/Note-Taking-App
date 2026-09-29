"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Stamp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { NoteEditor } from "@/components/editor/note-editor";
import { ShareResultDialog, type ShareResult } from "@/components/share/share-result-dialog";
import { ShareSettings, defaultShareDraft, toShareSettings, type ShareDraft } from "@/components/share/share-settings";
import { Button } from "@/components/ui/button";
import { ApiClientError, api, unwrap } from "@/lib/api-client";
import { scanForSensitiveData } from "@/lib/sensitive";
import { createNoteSchema } from "@/lib/validation";

type Prefs = Parameters<typeof defaultShareDraft>[0];

export function NewNoteForm({ preferences }: { preferences: Prefs }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [share, setShare] = useState<ShareDraft>(() => defaultShareDraft(preferences));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<(ShareResult & { noteId: string }) | null>(null);

  const deferredContent = useDeferredValue(`${title}\n${content}`);
  const findings = useMemo(() => scanForSensitiveData(deferredContent), [deferredContent]);
  const dirty = (title.trim() || content.trim()) && !result;

  // Warn before leaving with unsaved work (drafts are deliberately not stored in the browser).
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function submit() {
    const payload = { title, content, share: toShareSettings(share) };
    const parsed = createNoteSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] === "share" ? String(issue.path[1]) : String(issue.path[0]);
        next[key] ??= issue.message;
      }
      setErrors(next);
      toast.error(Object.values(next)[0]);
      return;
    }

    setErrors({});
    setPending(true);
    try {
      const res = await unwrap(api.notes.$post({ json: { title, content, share: payload.share } }));
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      setResult({ ...res, noteId: res.note.id });
    } catch (error) {
      if (error instanceof ApiClientError) {
        const fields = Object.fromEntries(Object.entries(error.fields).map(([k, v]) => [k.replace(/^share\./, ""), v]));
        setErrors(fields);
        toast.error(error.message);
      } else toast.error("Could not create the note.");
    } finally {
      setPending(false);
    }
  }

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
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/notes" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors">
            <ArrowLeft className="size-4" /> All notes
          </Link>
          <h1 className="font-display mt-2 text-4xl tracking-tight">New sealed note</h1>
        </div>
        <Button type="submit" variant="gold" size="xl" disabled={pending} className="hidden lg:inline-flex">
          {pending ? <Loader2 className="animate-spin" /> : <Stamp />} Seal & create link
        </Button>
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
          autoFocus
        />

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="hairline bg-card rounded-2xl p-5">
            <h2 className="font-display text-2xl tracking-tight">Seal settings</h2>
            <p className="text-muted-foreground mt-1 mb-5 text-xs">Choose how this note may be opened. You can add more links later.</p>
            <ShareSettings value={share} onChange={setShare} errors={errors} findings={findings} />
            <Button type="submit" variant="gold" size="xl" disabled={pending} className="mt-6 w-full">
              {pending ? <Loader2 className="animate-spin" /> : <Stamp />} Seal & create link
            </Button>
            <p className="text-muted-foreground mt-2 text-center text-[11px]">
              or press <kbd className="bg-muted rounded px-1 font-mono">Ctrl</kbd> + <kbd className="bg-muted rounded px-1 font-mono">Enter</kbd>
            </p>
          </div>
        </aside>
      </div>

      <ShareResultDialog
        result={result}
        closeLabel="View note"
        onClose={() => {
          const id = result?.noteId;
          setResult(null);
          if (id) router.push(`/notes/${id}`);
        }}
      />
    </form>
  );
}
