"use client";

import { Loader2, Sparkles, Square } from "lucide-react";
import { useState } from "react";
import { Markdown } from "@/components/lazy-markdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAiStream } from "@/hooks/use-ai-stream";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/constants";
import { getTemplates, type Template } from "./templates";

const FORMATS = [
  { id: "note", label: "Note" },
  { id: "checklist", label: "Checklist" },
  { id: "meeting", label: "Meeting notes" },
  { id: "email", label: "Email draft" },
  { id: "plan", label: "Plan" },
] as const;

const IDEAS = ["A packing list for a 3-day trip to Manali", "Onboarding checklist for a new developer", "Agenda for a 30-minute weekly team sync", "A polite email asking for a deadline extension"];

/** Splits "# Title\n\nbody" produced by the AI into title + content. */
export function splitGenerated(text: string) {
  const match = text.match(/^\s*#\s+(.+)\n+/);
  return match ? { title: match[1]!.trim().slice(0, LIMITS.titleMax), content: text.slice(match[0].length).trim() } : { title: "", content: text.trim() };
}

export function AiWriteDialog({ open, onOpenChange, onUse }: { open: boolean; onOpenChange: (o: boolean) => void; onUse: (draft: { title: string; content: string }) => void }) {
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState<(typeof FORMATS)[number]["id"]>("note");
  const stream = useAiStream();

  const generate = () => prompt.trim().length >= 3 && stream.start("/api/ai/generate", { prompt, format });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) stream.reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-3xl font-normal">
            <Sparkles className="text-gold size-6" /> Write with AI
          </DialogTitle>
          <DialogDescription>Describe what you need — Gemini drafts it, you edit and seal it.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                void generate();
              }
            }}
            rows={3}
            maxLength={2000}
            autoFocus
            placeholder="e.g. A checklist for launching our new website next Friday"
            aria-label="What should the AI write?"
            className="border-input bg-background/40 focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-xl border px-3.5 py-3 text-sm outline-none focus-visible:ring-3"
          />
          {!prompt && (
            <div className="flex flex-wrap gap-1.5">
              {IDEAS.map((idea) => (
                <button key={idea} type="button" onClick={() => setPrompt(idea)} className="border-border hover:border-gold/50 hover:bg-gold-soft/40 rounded-full border px-3 py-1 text-xs transition-colors">
                  {idea}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-muted flex flex-wrap rounded-xl p-1" role="radiogroup" aria-label="Format">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={format === f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn("rounded-lg px-2.5 py-1 text-xs transition-all", format === f.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {stream.status === "streaming" ? (
              <Button type="button" variant="outline" className="ml-auto" onClick={stream.stop}>
                <Square className="size-3" /> Stop
              </Button>
            ) : (
              <Button type="button" variant="gold" className="ml-auto" disabled={prompt.trim().length < 3} onClick={() => void generate()}>
                <Sparkles /> {stream.status === "done" ? "Regenerate" : "Generate"}
              </Button>
            )}
          </div>
        </div>

        {stream.status !== "idle" && (
          <div className="border-border bg-muted/20 max-h-[45vh] overflow-y-auto rounded-xl border p-4">
            {stream.status === "error" ? (
              <p className="text-destructive text-sm">{stream.error}</p>
            ) : stream.text ? (
              <Markdown className="prose-sm">{stream.text}</Markdown>
            ) : (
              <Loader2 className="text-gold size-5 animate-spin" />
            )}
          </div>
        )}

        {stream.status === "done" && stream.text && (
          <Button
            type="button"
            variant="gold"
            size="lg"
            onClick={() => {
              onUse(splitGenerated(stream.text));
              stream.reset();
              onOpenChange(false);
            }}
          >
            Use this draft
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TemplateDialog({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (t: Template) => void }) {
  const templates = getTemplates();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">Start from a template</DialogTitle>
          <DialogDescription>Ready-made structures. Sensitive templates also pre-select safer share settings.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onPick(t);
                onOpenChange(false);
              }}
              className="border-border hover:border-gold/50 hover:bg-gold-soft/40 flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors"
            >
              <span className="bg-gold-soft text-gold grid size-9 shrink-0 place-items-center rounded-lg">
                <t.icon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="text-muted-foreground block text-xs">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Reads a local .md / .txt file into a note draft (never uploaded as a file). */
export async function readNoteFile(file: File): Promise<{ title: string; content: string }> {
  if (file.size > 200_000) throw new Error("That file is too large (max 200 KB).");
  const text = (await file.text()).replace(/\r\n/g, "\n");
  const heading = text.match(/^\s*#\s+(.+)\n+/);
  const title = (heading?.[1] ?? file.name.replace(/\.(md|markdown|txt)$/i, "")).trim().slice(0, LIMITS.titleMax);
  const content = (heading ? text.slice(heading[0].length) : text).slice(0, LIMITS.contentMax);
  return { title: title || "Imported note", content };
}
