"use client";

import {
  AlignLeft,
  Check,
  ChevronDown,
  Expand,
  Eye,
  List,
  Loader2,
  PenLine,
  Scissors,
  SpellCheck,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAiAssist } from "@/hooks/use-ai-assist";
import { useAiStatus } from "@/hooks/use-notes";
import { cn } from "@/lib/utils";
import { LIMITS, type AiAction } from "@/lib/validation";

const AI_ACTIONS: { action: Exclude<AiAction, "title">; label: string; icon: typeof Wand2 }[] = [
  { action: "improve", label: "Improve writing", icon: Wand2 },
  { action: "grammar", label: "Fix spelling & grammar", icon: SpellCheck },
  { action: "shorten", label: "Make shorter", icon: Scissors },
  { action: "expand", label: "Make longer", icon: Expand },
  { action: "summarize", label: "Summarize", icon: AlignLeft },
  { action: "bulletize", label: "Turn into bullet points", icon: List },
];

export function NoteEditor({
  title,
  content,
  onTitleChange,
  onContentChange,
  errors = {},
  autoFocus,
}: {
  title: string;
  content: string;
  onTitleChange: (v: string) => void;
  onContentChange: (v: string) => void;
  errors?: { title?: string; content?: string };
  autoFocus?: boolean;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const ai = useAiAssist();
  const titleAi = useAiAssist();
  const { data: aiStatus } = useAiStatus();
  const aiReady = aiStatus?.available && aiStatus.enabled;
  const aiHint = !aiStatus?.available
    ? "AI assistant is not configured on this server"
    : !aiStatus.enabled
      ? "AI assistant is turned off in Settings"
      : undefined;

  const over = content.length > LIMITS.contentMax;

  async function suggestTitle() {
    if (!content.trim()) return toast.info("Write a little first — the title is based on your note.");
    const suggestion = await titleAi.run("title", content);
    if (suggestion) {
      onTitleChange(suggestion.slice(0, LIMITS.titleMax));
      toast.success("Title suggested");
    } else {
      toast.error("Couldn’t suggest a title right now. Please try again.");
    }
  }

  function runAi(action: AiAction) {
    if (!content.trim()) return toast.info("Write something first, then let AI polish it.");
    setTab("write");
    void ai.run(action, content);
  }

  return (
    <div className="hairline bg-card min-w-0 rounded-2xl">
      <div className="flex items-start gap-2 px-5 pt-5 sm:px-7 sm:pt-7">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled note"
          maxLength={LIMITS.titleMax}
          autoFocus={autoFocus}
          aria-label="Title"
          aria-invalid={!!errors.title}
          className="font-display placeholder:text-muted-foreground/50 w-full min-w-0 flex-1 bg-transparent text-4xl tracking-tight outline-none sm:text-5xl"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button type="button" variant="ghost" size="icon" onClick={suggestTitle} disabled={!aiReady || titleAi.status === "streaming"} aria-label="Suggest a title with AI" className="mt-1.5">
                {titleAi.status === "streaming" ? <Loader2 className="animate-spin" /> : <Sparkles className="text-gold" />}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{aiHint ?? "Suggest a title with AI"}</TooltipContent>
        </Tooltip>
      </div>
      {errors.title && <p className="text-destructive px-5 pt-1 text-xs sm:px-7">{errors.title}</p>}

      <div className="border-border mt-4 flex items-center gap-1 border-y px-3 py-1.5 sm:px-5">
        {(["write", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "write" ? <PenLine className="size-3.5" /> : <Eye className="size-3.5" />}
            {t === "write" ? "Write" : "Preview"}
          </button>
        ))}
        <span className="text-muted-foreground ml-2 hidden text-[11px] sm:inline">Markdown supported</span>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="ml-auto">
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={!aiReady || ai.status === "streaming"} className="border-gold/40">
                    {ai.status === "streaming" ? <Loader2 className="animate-spin" /> : <Sparkles className="text-gold" />}
                    AI<span className="hidden sm:inline">&nbsp;assist</span>
                    <ChevronDown className="opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
              </span>
            </TooltipTrigger>
            {aiHint && <TooltipContent>{aiHint}</TooltipContent>}
          </Tooltip>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Rewrite this note</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {AI_ACTIONS.map(({ action, label, icon: Icon }) => (
              <DropdownMenuItem key={action} onSelect={() => runAi(action)}>
                <Icon /> {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AnimatePresence>
        {ai.status !== "idle" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-gold/30 bg-gold-soft/60 overflow-hidden border-b"
          >
            <div className="px-5 py-4 sm:px-7">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                <Sparkles className="text-gold size-3.5" />
                {ai.status === "error" ? "AI assistant" : `AI suggestion · ${AI_ACTIONS.find((a) => a.action === ai.action)?.label ?? ""}`}
                {ai.status === "streaming" && <Loader2 className="text-muted-foreground size-3.5 animate-spin" />}
              </div>
              {ai.status === "error" ? (
                <p className="text-destructive text-sm">{ai.error}</p>
              ) : (
                <div className="max-h-72 overflow-y-auto pr-1">
                  <Markdown className="prose-sm">{ai.text || "…"}</Markdown>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {ai.status === "done" && (
                  <>
                    <Button type="button" size="sm" variant="gold" onClick={() => { onContentChange(ai.text.slice(0, LIMITS.contentMax)); ai.reset(); toast.success("Replaced with AI suggestion"); }}>
                      <Check /> Replace note
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => { onContentChange(`${content.trimEnd()}\n\n${ai.text}`.slice(0, LIMITS.contentMax)); ai.reset(); }}>
                      Insert below
                    </Button>
                  </>
                )}
                <Button type="button" size="sm" variant="ghost" onClick={ai.reset}>
                  <X /> {ai.status === "streaming" ? "Stop" : "Discard"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tab === "write" ? (
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder={"Start writing…\n\nTip: use **bold**, _italics_, lists, `code` and # headings."}
          aria-label="Content"
          aria-invalid={!!errors.content}
          className="placeholder:text-muted-foreground/50 block min-h-[22rem] w-full resize-y bg-transparent px-5 py-5 text-[15px] leading-7 outline-none sm:px-7"
        />
      ) : (
        <div className="min-h-[22rem] px-5 py-5 sm:px-7">
          {content.trim() ? <Markdown>{content}</Markdown> : <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>}
        </div>
      )}

      <div className="border-border flex items-center justify-between border-t px-5 py-2.5 text-xs sm:px-7">
        <span className={cn("text-destructive", !errors.content && "invisible")}>{errors.content ?? "·"}</span>
        <span className={cn("tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
          {content.length.toLocaleString()} / {LIMITS.contentMax.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
