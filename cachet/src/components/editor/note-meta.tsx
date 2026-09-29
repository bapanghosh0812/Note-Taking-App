"use client";

import { Check, Hash, Loader2, Palette, Pin, Sparkles, X } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAiStatus, useTags } from "@/hooks/use-notes";
import { api, errorMessage, unwrap } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { NOTE_COLORS } from "@/lib/constants";

export type NoteColor = (typeof NOTE_COLORS)[number];

const MAX_TAGS = 10;
const normalizeTag = (t: string) => t.trim().toLowerCase().replace(/^#/, "").slice(0, 24);

export function TagInput({ value, onChange, title, content }: { value: string[]; onChange: (tags: string[]) => void; title: string; content: string }) {
  const [draft, setDraft] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const listId = useId();
  const { data: existing } = useTags();
  const { data: ai } = useAiStatus();

  const add = (raw: string) => {
    const tag = normalizeTag(raw);
    if (!tag || value.includes(tag)) return;
    if (value.length >= MAX_TAGS) return toast.info(`Up to ${MAX_TAGS} tags per note`);
    if (!/^[\p{L}\p{N} _-]+$/u.test(tag)) return toast.error("Tags can use letters, numbers, spaces, - and _");
    onChange([...value, tag]);
  };

  async function suggest() {
    if (!content.trim()) return toast.info("Write something first — tags are based on your note.");
    setSuggesting(true);
    try {
      const res = await unwrap(api.ai.tags.$post({ json: { title, text: content } }));
      const next = [...new Set([...value, ...res.tags.map(normalizeTag).filter(Boolean)])].slice(0, MAX_TAGS);
      onChange(next);
      toast.success(res.tags.length ? `Added ${res.tags.length} AI tag${res.tags.length === 1 ? "" : "s"}` : "No tags suggested");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      <Hash className="text-muted-foreground size-3.5 shrink-0" />
      {value.map((tag) => (
        <span key={tag} className="bg-muted inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove tag ${tag}`} className="hover:bg-foreground/10 rounded-full p-0.5">
            <X className="size-3" />
          </button>
        </span>
      ))}
      {value.length < MAX_TAGS && (
        <input
          value={draft}
          list={listId}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) add(draft);
            setDraft("");
          }}
          placeholder={value.length ? "Add tag" : "Add tags…"}
          aria-label="Add a tag"
          className="placeholder:text-muted-foreground/60 min-w-20 flex-1 bg-transparent py-1 text-xs outline-none"
        />
      )}
      <datalist id={listId}>
        {existing?.tags.filter((t) => !value.includes(t.tag)).map((t) => <option key={t.tag} value={t.tag} />)}
      </datalist>
      {ai?.available && ai.enabled && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" onClick={suggest} disabled={suggesting} aria-label="Suggest tags with AI">
              {suggesting ? <Loader2 className="animate-spin" /> : <Sparkles className="text-gold" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Suggest tags with AI</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

const SWATCH: Record<NoteColor, string> = {
  none: "bg-transparent border-dashed",
  amber: "bg-[oklch(0.8_0.14_75)]",
  rose: "bg-[oklch(0.7_0.16_12)]",
  emerald: "bg-[oklch(0.72_0.14_160)]",
  sky: "bg-[oklch(0.72_0.12_235)]",
  violet: "bg-[oklch(0.68_0.15_295)]",
  slate: "bg-[oklch(0.6_0.02_250)]",
};

export function ColorPicker({ value, onChange }: { value: NoteColor; onChange: (c: NoteColor) => void }) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Note colour">
              {value === "none" ? <Palette /> : <span className={cn("size-4 rounded-full", SWATCH[value])} />}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Colour label</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-auto p-2" align="end">
        <div className="flex gap-1.5">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={c === "none" ? "No colour" : c}
              className={cn("border-border grid size-7 place-items-center rounded-full border transition-transform hover:scale-110", SWATCH[c])}
            >
              {value === c && <Check className={cn("size-3.5", c === "none" ? "text-foreground" : "text-white")} />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PinToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(!value)} aria-pressed={value} aria-label={value ? "Unpin" : "Pin to top"}>
          <Pin className={cn(value && "text-gold fill-current")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{value ? "Pinned" : "Pin to top"}</TooltipContent>
    </Tooltip>
  );
}
