"use client";

import { ArrowUp, Bot, Check, Copy, FileText, Loader2, RotateCcw, Sparkles, Square, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAiStatus } from "@/hooks/use-notes";
import { useAiStream } from "@/hooks/use-ai-stream";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };

const GENERAL_PROMPTS = [
  "How do one-time links work?",
  "How can I make my account more secure?",
  "Write a checklist for moving to a new flat",
  "Give me 5 ideas for a weekly review note",
];
const NOTE_PROMPTS = ["Summarize this note", "What are the action items?", "Is it safe to share this publicly?", "Suggest a better structure"];

export function AiAssistant({
  open,
  onOpenChange,
  note,
  onClearNote,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  note?: { noteId: string; noteTitle: string };
  onClearNote: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const stream = useAiStream();
  const { data: status } = useAiStatus();
  const endRef = useRef<HTMLDivElement>(null);
  const ready = status?.available && status.enabled;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, stream.text]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || stream.status === "streaming") return;
    const history: Message[] = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    const answer = await stream.start("/api/ai/chat", { messages: history.slice(-20), noteId: note?.noteId });
    if (answer) setMessages([...history, { role: "assistant", content: answer }]);
  }

  const prompts = note ? NOTE_PROMPTS : GENERAL_PROMPTS;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b px-5 py-4">
          <SheetTitle className="font-display flex items-center gap-2 text-2xl font-normal">
            <span className="bg-accent-gradient grid size-8 place-items-center rounded-full">
              <Sparkles className="size-4" />
            </span>
            Cachet Assistant
          </SheetTitle>
          <SheetDescription>
            Powered by Gemini. Ask about your notes or how to use Cachet. {messages.length > 0 && (
              <button type="button" onClick={() => { stream.reset(); setMessages([]); }} className="text-gold inline-flex items-center gap-1 underline-offset-2 hover:underline">
                <RotateCcw className="size-3" /> New chat
              </button>
            )}
          </SheetDescription>
          {note && (
            <div className="border-gold/30 bg-gold-soft mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
              <FileText className="text-gold size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Using note: <strong>{note.noteTitle}</strong></span>
              <button type="button" onClick={onClearNote} aria-label="Stop using this note" className="text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!ready ? (
            <div className="text-muted-foreground py-10 text-center text-sm">
              <Bot className="mx-auto mb-3 size-8 opacity-60" />
              {status?.available === false ? "The AI assistant is not configured on this server." : "The AI assistant is turned off."}
              <p className="mt-2">
                <Link href="/settings?tab=ai" className="text-gold underline underline-offset-4" onClick={() => onOpenChange(false)}>
                  AI settings
                </Link>
              </p>
            </div>
          ) : messages.length === 0 && stream.status !== "streaming" ? (
            <div className="pt-4">
              <p className="font-display text-3xl leading-tight">How can I help{note ? " with this note" : ""}?</p>
              <div className="mt-6 grid gap-2">
                {prompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => send(p)}
                    className="border-border hover:border-gold/50 hover:bg-gold-soft/40 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role === "user" ? (
                    <p className="bg-gold-soft max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div className="group max-w-[95%]">
                      <Markdown className="prose-sm">{m.content}</Markdown>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                        onClick={async () => {
                          await navigator.clipboard.writeText(m.content).catch(() => toast.error("Clipboard unavailable"));
                          setCopied(i);
                          setTimeout(() => setCopied(null), 1500);
                        }}
                      >
                        {copied === i ? <Check className="size-3" /> : <Copy className="size-3" />} Copy
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {stream.status === "streaming" && (
                <div className="max-w-[95%]">
                  {stream.text ? <Markdown className="prose-sm">{stream.text}</Markdown> : <Loader2 className="text-gold size-4 animate-spin" />}
                </div>
              )}
              {stream.status === "error" && <p className="text-destructive text-sm">{stream.error}</p>}
            </>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="border-border border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="border-input bg-background/40 focus-within:border-ring focus-within:ring-ring/40 flex items-end gap-2 rounded-2xl border p-2 focus-within:ring-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              maxLength={4000}
              disabled={!ready}
              placeholder={note ? "Ask about this note…" : "Ask anything…"}
              aria-label="Message"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none [field-sizing:content]"
            />
            {stream.status === "streaming" ? (
              <Button type="button" size="icon-sm" variant="outline" onClick={stream.stop} aria-label="Stop">
                <Square className="size-3" />
              </Button>
            ) : (
              <Button type="submit" size="icon-sm" variant="gold" disabled={!input.trim() || !ready} aria-label="Send">
                <ArrowUp />
              </Button>
            )}
          </div>
          <p className="text-muted-foreground/70 mt-1.5 text-center text-[10px]">AI can make mistakes. Your note is only sent when you ask.</p>
        </form>
      </SheetContent>
    </Sheet>
  );
}
