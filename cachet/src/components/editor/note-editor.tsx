"use client";

import {
  AlignLeft,
  Bold,
  Check,
  ChevronDown,
  Code,
  Columns2,
  Expand,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Languages,
  Lightbulb,
  Link as LinkIcon,
  List,
  ListChecks,
  ListOrdered,
  ListTodo,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  Minus,
  PenLine,
  Quote,
  Scissors,
  Sparkles,
  SpellCheck,
  SquareCode,
  Strikethrough,
  Table,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { Markdown } from "@/components/lazy-markdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAiStream } from "@/hooks/use-ai-stream";
import { useAiStatus } from "@/hooks/use-notes";
import { usePreferences } from "@/hooks/use-preferences";
import { cn } from "@/lib/utils";
import { AI_LANGUAGES, AI_TONES, LIMITS, type AiAction } from "@/lib/constants";
import { TABLE, insertBlock, link, prefixLines, stats, wrap, type Edit, type Selection } from "./markdown-format";

type Tool = { label: string; icon: LucideIcon; shortcut?: string; apply: (s: Selection) => Edit };

const TOOLS: (Tool | "sep")[] = [
  { label: "Bold", icon: Bold, shortcut: "Ctrl B", apply: (s) => wrap(s, "**", "**", "bold text") },
  { label: "Italic", icon: Italic, shortcut: "Ctrl I", apply: (s) => wrap(s, "_", "_", "italic text") },
  { label: "Strikethrough", icon: Strikethrough, apply: (s) => wrap(s, "~~", "~~", "text") },
  { label: "Inline code", icon: Code, apply: (s) => wrap(s, "`", "`", "code") },
  "sep",
  { label: "Heading 1", icon: Heading1, apply: (s) => prefixLines(s, "# ") },
  { label: "Heading 2", icon: Heading2, apply: (s) => prefixLines(s, "## ") },
  { label: "Heading 3", icon: Heading3, apply: (s) => prefixLines(s, "### ") },
  "sep",
  { label: "Bulleted list", icon: List, apply: (s) => prefixLines(s, "- ") },
  { label: "Numbered list", icon: ListOrdered, apply: (s) => prefixLines(s, (i) => `${i + 1}. `) },
  { label: "Checklist", icon: ListChecks, apply: (s) => prefixLines(s, "- [ ] ") },
  { label: "Quote", icon: Quote, apply: (s) => prefixLines(s, "> ") },
  "sep",
  { label: "Link", icon: LinkIcon, shortcut: "Ctrl Shift K", apply: link },
  { label: "Code block", icon: SquareCode, apply: (s) => insertBlock(s, "```\ncode\n```", 4, 4) },
  { label: "Table", icon: Table, apply: (s) => insertBlock(s, TABLE) },
  { label: "Divider", icon: Minus, apply: (s) => insertBlock(s, "---") },
];

const REWRITE: { action: AiAction; label: string; icon: LucideIcon }[] = [
  { action: "improve", label: "Improve writing", icon: Wand2 },
  { action: "grammar", label: "Fix spelling & grammar", icon: SpellCheck },
  { action: "shorten", label: "Make shorter", icon: Scissors },
  { action: "expand", label: "Make longer", icon: Expand },
  { action: "bulletize", label: "Turn into bullet points", icon: List },
];
const ANALYZE: { action: AiAction; label: string; icon: LucideIcon }[] = [
  { action: "summarize", label: "Summarize", icon: AlignLeft },
  { action: "action_items", label: "Extract action items", icon: ListTodo },
  { action: "explain", label: "Explain simply", icon: Lightbulb },
  { action: "continue", label: "Continue writing", icon: PenLine },
];
const ACTION_LABELS: Record<string, string> = Object.fromEntries([...REWRITE, ...ANALYZE].map((a) => [a.action, a.label]));

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
};

export function NoteEditor({
  title,
  content,
  onTitleChange,
  onContentChange,
  errors = {},
  autoFocus,
  meta,
  status,
  onSave,
  readOnly,
}: {
  title: string;
  content: string;
  onTitleChange: (v: string) => void;
  onContentChange: (v: string) => void;
  errors?: { title?: string; content?: string };
  autoFocus?: boolean;
  meta?: React.ReactNode;
  status?: React.ReactNode;
  onSave?: () => void;
  readOnly?: boolean;
}) {
  const { prefs } = usePreferences();
  const [mode, setMode] = useState(prefs.editorView);
  const [focus, setFocus] = useState(false);
  const [dictating, setDictating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const ai = useAiStream();
  const titleAi = useAiStream();
  const [aiAction, setAiAction] = useState("");
  const { data: aiStatus } = useAiStatus();
  const aiReady = Boolean(aiStatus?.available && aiStatus.enabled);
  const aiHint = !aiStatus?.available ? "AI is not configured on this server" : !aiStatus.enabled ? "AI is turned off in Settings" : undefined;
  const { words, chars, minutes } = stats(content);

  // Restore the caret after a toolbar edit re-renders the textarea.
  useLayoutEffect(() => {
    const sel = pendingSelection.current;
    const el = textareaRef.current;
    if (sel && el) {
      el.focus();
      el.setSelectionRange(sel.start, sel.end);
      pendingSelection.current = null;
    }
  });

  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFocus(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  function applyTool(tool: Tool) {
    const el = textareaRef.current;
    if (readOnly) return;
    if (mode === "preview") setMode("write");
    const selection = el ? { value: content, start: el.selectionStart, end: el.selectionEnd } : { value: content, start: content.length, end: content.length };
    const edit = tool.apply(selection);
    if (edit.value.length > LIMITS.contentMax) return toast.error("The note is at its size limit.");
    pendingSelection.current = { start: edit.start, end: edit.end };
    onContentChange(edit.value);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    const find = (label: string) => TOOLS.find((t): t is Tool => t !== "sep" && t.label === label)!;
    if (key === "b") {
      e.preventDefault();
      applyTool(find("Bold"));
    } else if (key === "i") {
      e.preventDefault();
      applyTool(find("Italic"));
    } else if (key === "k" && e.shiftKey) {
      e.preventDefault();
      applyTool(find("Link"));
    } else if (key === "s" && onSave) {
      e.preventDefault();
      onSave();
    }
  }

  async function suggestTitle() {
    if (!content.trim()) return toast.info("Write a little first — the title is based on your note.");
    const suggestion = await titleAi.start("/api/ai/assist", { action: "title", text: content });
    if (suggestion) {
      onTitleChange(suggestion.replace(/^["'“”#\s]+|["'“”.]+$/g, "").slice(0, LIMITS.titleMax));
      toast.success("Title suggested");
    } else toast.error("Couldn’t suggest a title right now.");
  }

  function runAi(action: AiAction, extra: { language?: string; tone?: string } = {}) {
    if (!content.trim()) return toast.info("Write something first, then let AI help.");
    setAiAction(extra.language ? `Translate to ${extra.language}` : extra.tone ? `Make it ${extra.tone}` : (ACTION_LABELS[action] ?? action));
    void ai.start("/api/ai/assist", { action, text: content, ...extra });
  }

  // Voice typing with the browser's own speech recognition (Chrome/Edge). Nothing goes to our server.
  function dictate() {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return toast.error("Voice typing isn’t supported in this browser. Try Chrome or Edge.");
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (text) onContentChange(`${content}${content && !/\s$/.test(content) ? " " : ""}${text}`.slice(0, LIMITS.contentMax));
    };
    rec.onend = () => setDictating(false);
    rec.onerror = () => {
      setDictating(false);
      toast.error("Voice typing stopped (microphone blocked or no speech heard).");
    };
    setDictating(true);
    toast.info("Listening… speak now.");
    rec.start();
  }

  const over = content.length > LIMITS.contentMax;
  const editorFont = { sans: "font-sans", serif: "font-display text-[17px] leading-8", mono: "font-mono text-sm" }[prefs.editorFont];

  const textarea = (
    <textarea
      ref={textareaRef}
      value={content}
      onChange={(e) => onContentChange(e.target.value)}
      onKeyDown={onKeyDown}
      readOnly={readOnly}
      spellCheck={prefs.spellcheck}
      placeholder={"Start writing…\n\nUse the toolbar or Markdown: **bold**, _italic_, - lists, - [ ] checklists, # headings."}
      aria-label="Content"
      aria-invalid={!!errors.content}
      className={cn(
        "placeholder:text-muted-foreground/50 block w-full resize-none bg-transparent px-5 py-5 text-[15px] leading-7 outline-none [field-sizing:content] sm:px-7",
        focus ? "min-h-[70vh]" : "min-h-[24rem]",
        editorFont,
      )}
    />
  );
  const preview = (
    <div className="min-h-[24rem] px-5 py-5 sm:px-7">
      {content.trim() ? <Markdown>{content}</Markdown> : <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>}
    </div>
  );

  return (
    <div className={cn(focus && "bg-background fixed inset-0 z-50 overflow-y-auto px-4")}>
      <div className={cn("hairline bg-card min-w-0 rounded-2xl", focus && "mx-auto my-8 max-w-3xl")}>
        {/* Title */}
        <div className="flex items-start gap-2 px-5 pt-5 sm:px-7 sm:pt-7">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled note"
            maxLength={LIMITS.titleMax}
            autoFocus={autoFocus}
            readOnly={readOnly}
            aria-label="Title"
            aria-invalid={!!errors.title}
            className="font-display placeholder:text-muted-foreground/50 w-full min-w-0 flex-1 bg-transparent text-4xl tracking-tight outline-none sm:text-5xl"
          />
          {!readOnly && (
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
          )}
        </div>
        {errors.title && <p className="text-destructive px-5 pt-1 text-xs sm:px-7">{errors.title}</p>}
        {meta && <div className="flex flex-wrap items-center gap-2 px-5 pt-3 sm:px-7">{meta}</div>}

        {/* Toolbar */}
        {!readOnly && (
          <div className="border-border bg-card/95 sticky top-16 z-10 mt-4 flex items-center gap-1 overflow-x-auto border-y px-2 py-1.5 sm:px-4">
            <div className="flex shrink-0 items-center">
              {TOOLS.map((tool, i) =>
                tool === "sep" ? (
                  <span key={`sep-${i}`} className="bg-border mx-1 h-5 w-px" />
                ) : (
                  <Tooltip key={tool.label}>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => applyTool(tool)} aria-label={tool.label}>
                        <tool.icon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {tool.label}
                      {tool.shortcut && <span className="ml-2 opacity-70">{tool.shortcut}</span>}
                    </TooltipContent>
                  </Tooltip>
                ),
              )}
              <span className="bg-border mx-1 h-5 w-px" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={dictate} disabled={dictating} aria-label="Voice typing">
                    <Mic className={cn(dictating && "text-destructive animate-pulse")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Voice typing</TooltipContent>
              </Tooltip>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">
              <div className="bg-muted hidden rounded-lg p-0.5 sm:flex" role="radiogroup" aria-label="Editor view">
                {(
                  [
                    ["write", PenLine, "Write"],
                    ["split", Columns2, "Split view"],
                    ["preview", Eye, "Preview"],
                  ] as const
                ).map(([id, Icon, label]) => (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={mode === id}
                        aria-label={label}
                        onClick={() => setMode(id)}
                        className={cn("rounded-md p-1.5 transition-all", mode === id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
                      >
                        <Icon className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <Button type="button" variant="ghost" size="icon-sm" className="sm:hidden" onClick={() => setMode(mode === "preview" ? "write" : "preview")} aria-label="Toggle preview">
                {mode === "preview" ? <PenLine /> : <Eye />}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setFocus((f) => !f)} aria-label={focus ? "Exit focus mode" : "Focus mode"}>
                    {focus ? <Minimize2 /> : <Maximize2 />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{focus ? "Exit focus mode (Esc)" : "Focus mode"}</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="outline" size="sm" disabled={!aiReady || ai.status === "streaming"} className="border-gold/40">
                          {ai.status === "streaming" ? <Loader2 className="animate-spin" /> : <Sparkles className="text-gold" />}
                          AI
                          <ChevronDown className="opacity-60" />
                        </Button>
                      </DropdownMenuTrigger>
                    </span>
                  </TooltipTrigger>
                  {aiHint && <TooltipContent>{aiHint}</TooltipContent>}
                </Tooltip>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Rewrite</DropdownMenuLabel>
                  {REWRITE.map(({ action, label, icon: Icon }) => (
                    <DropdownMenuItem key={action} onSelect={() => runAi(action)}>
                      <Icon /> {label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Languages /> Translate to…
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      {AI_LANGUAGES.map((language) => (
                        <DropdownMenuItem key={language} onSelect={() => runAi("translate", { language })}>
                          {language}
                          {language === prefs.aiLanguage && <Check className="ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Wand2 /> Change tone
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      {AI_TONES.map((tone) => (
                        <DropdownMenuItem key={tone} onSelect={() => runAi("tone", { tone })} className="capitalize">
                          {tone}
                          {tone === prefs.aiTone && <Check className="ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Understand</DropdownMenuLabel>
                  {ANALYZE.map(({ action, label, icon: Icon }) => (
                    <DropdownMenuItem key={action} onSelect={() => runAi(action)}>
                      <Icon /> {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        {/* AI result */}
        {ai.status !== "idle" && (
            <div className="border-gold/30 bg-gold-soft/60 animate-rise overflow-hidden border-b [animation-duration:0.3s]">
              <div className="px-5 py-4 sm:px-7">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                  <Sparkles className="text-gold size-3.5" />
                  {ai.status === "error" ? "AI assistant" : `AI · ${aiAction}`}
                  {ai.status === "streaming" && <Loader2 className="text-muted-foreground size-3.5 animate-spin" />}
                </div>
                {ai.status === "error" ? (
                  <p className="text-destructive text-sm">{ai.error}</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto pr-1">
                    <Markdown className="prose-sm">{ai.text || "…"}</Markdown>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {ai.status === "done" && (
                    <>
                      {aiAction !== ACTION_LABELS.continue && (
                        <Button
                          type="button"
                          size="sm"
                          variant="gold"
                          onClick={() => {
                            onContentChange(ai.text.slice(0, LIMITS.contentMax));
                            ai.reset();
                            toast.success("Replaced with AI suggestion");
                          }}
                        >
                          <Check /> Replace note
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant={aiAction === ACTION_LABELS.continue ? "gold" : "outline"}
                        onClick={() => {
                          onContentChange(`${content.trimEnd()}\n\n${ai.text}`.slice(0, LIMITS.contentMax));
                          ai.reset();
                        }}
                      >
                        Insert below
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          void navigator.clipboard.writeText(ai.text);
                          toast.success("Copied");
                        }}
                      >
                        Copy
                      </Button>
                    </>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={ai.status === "streaming" ? ai.stop : ai.reset}>
                    <X /> {ai.status === "streaming" ? "Stop" : "Discard"}
                  </Button>
                </div>
              </div>
            </div>
          )}

        {/* Body */}
        {readOnly || mode === "preview" ? (
          preview
        ) : mode === "split" ? (
          <div className="divide-border grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
            {textarea}
            <div className="bg-muted/20 min-w-0">{preview}</div>
          </div>
        ) : (
          textarea
        )}

        {/* Status bar */}
        <div className="border-border text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-5 py-2.5 text-xs sm:px-7">
          {errors.content ? <span className="text-destructive">{errors.content}</span> : status}
          {prefs.showWordCount && (
            <span className="ml-auto tabular-nums">
              {words.toLocaleString()} words · {minutes} min read ·{" "}
              <span className={cn(over && "text-destructive")}>
                {chars.toLocaleString()}/{LIMITS.contentMax.toLocaleString()}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
