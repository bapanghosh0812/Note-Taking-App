"use client";

import { Bug, Heart, HelpCircle, Lightbulb, Loader2, Send } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, errorMessage, unwrap } from "@/lib/api-client";
import { Kbd } from "@/components/kbd";
import { SHORTCUTS } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

export { SHORTCUTS } from "@/lib/shortcuts";
export { Kbd } from "@/components/kbd";

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">Keyboard shortcuts</DialogTitle>
          <DialogDescription>Work faster without leaving the keyboard. On a Mac, use ⌘ instead of Ctrl.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {SHORTCUTS.map((group) => (
            <div key={group.group}>
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">{group.group}</p>
              <ul className="divide-border divide-y">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between py-2 text-sm">
                    {item.label}
                    <span className="flex gap-1">
                      {item.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const KINDS = [
  { id: "idea", label: "Idea", icon: Lightbulb },
  { id: "bug", label: "Bug", icon: Bug },
  { id: "question", label: "Question", icon: HelpCircle },
  { id: "praise", label: "Praise", icon: Heart },
] as const;

export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const pathname = usePathname();
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("idea");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) return toast.error("Tell us a little more (at least 5 characters).");
    setPending(true);
    try {
      await unwrap(api.account.feedback.$post({ json: { kind, message, page: pathname } }));
      toast.success("Thank you! Your feedback was sent.");
      setMessage("");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl font-normal">Send feedback</DialogTitle>
          <DialogDescription>Ideas, bugs or kind words — every message is read.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Feedback type">
            {KINDS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={kind === id}
                onClick={() => setKind(id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs transition-colors",
                  kind === id ? "border-gold bg-gold-soft" : "border-border hover:bg-muted/50",
                )}
              >
                <Icon className={cn("size-4", kind === id && "text-gold")} />
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="What’s on your mind?"
            aria-label="Feedback message"
            className="border-input bg-background/40 focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-xl border px-3.5 py-3 text-sm outline-none focus-visible:ring-3"
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs tabular-nums">{message.length}/2000</span>
            <Button type="submit" variant="gold" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />} Send
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
