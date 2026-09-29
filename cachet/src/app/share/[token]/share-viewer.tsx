"use client";

import {
  Ban,
  Clock,
  FileDown,
  Flame,
  Globe2,
  Hourglass,
  KeyRound,
  Link2Off,
  Loader2,
  Lock,
  Printer,
  ShieldCheck,
  TimerOff,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo, SealMark } from "@/components/brand/logo";
import { CopyButton } from "@/components/copy-button";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { ApiClientError, api, unwrap } from "@/lib/api-client";
import { countdown, friendlyDate } from "@/lib/format";
import { downloadText, slugify, toMarkdown } from "@/lib/note-export";
import { cn } from "@/lib/utils";

// The Markdown renderer is only needed once a note is revealed, so it isn't part of the initial download.
const Markdown = dynamic(() => import("@/components/markdown").then((m) => m.Markdown), {
  loading: () => <div className="bg-muted h-40 animate-pulse rounded-xl" />,
});

type Meta = { shareType: "one_time" | "time_based"; accessType: "public" | "password"; expiresAt: string; lockedUntil: string | null };
type Revealed = {
  note: { title: string; content: string; updatedAt: string; sharedBy: string };
  link: { shareType: "one_time" | "time_based"; accessType: "public" | "password"; expiresAt: string; consumed: boolean };
};
type Failure = { code: string; message: string; lockedUntil?: string; retryAfter?: number };

type State =
  | { kind: "loading" }
  | { kind: "gate"; meta: Meta }
  | { kind: "unlocking"; meta: Meta }
  | { kind: "revealed"; data: Revealed }
  | { kind: "failed"; failure: Failure; meta?: Meta };

const FAILURES: Record<string, { icon: LucideIcon; title: string; body: string }> = {
  link_invalid: { icon: Link2Off, title: "This link doesn’t exist", body: "It may be mistyped, or the note was deleted by its owner." },
  link_expired: { icon: TimerOff, title: "This note has expired", body: "The owner set this link to stop working after a certain time." },
  link_used: { icon: Flame, title: "Already opened", body: "This was a one-time note. It self-destructed after its first reading." },
  link_revoked: { icon: Ban, title: "Access revoked", body: "The owner has withdrawn this link. Ask them for a new one if you still need it." },
  link_locked: { icon: Lock, title: "Temporarily locked", body: "Too many wrong keys were tried. For safety, this link is paused for a while." },
  rate_limited: { icon: Hourglass, title: "Slow down a little", body: "Too many requests from your network. Please wait a moment and try again." },
};

function toFailure(error: unknown): Failure {
  if (error instanceof ApiClientError) {
    return {
      code: error.code,
      message: error.message,
      lockedUntil: typeof error.details.lockedUntil === "string" ? error.details.lockedUntil : undefined,
      retryAfter: typeof error.details.retryAfter === "number" ? error.details.retryAfter : undefined,
    };
  }
  return { code: "network", message: "We couldn’t reach Cachet. Check your connection and try again." };
}

/** Formats as the user types: "k7qm3x" → "K7QM-3X". */
function formatKey(raw: string) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return clean.match(/.{1,4}/g)?.join("-") ?? "";
}

export function ShareViewer({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [key, setKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState(0);
  const autoOpened = useRef(false);

  const access = useCallback(
    async (meta: Meta, providedKey?: string) => {
      setState({ kind: "unlocking", meta });
      try {
        const data = await unwrap(api.share[":token"].access.$post({ param: { token }, json: providedKey ? { key: providedKey } : {} }));
        setState({ kind: "revealed", data });
      } catch (error) {
        const failure = toFailure(error);
        if (failure.code === "key_invalid" || failure.code === "key_required") {
          const remaining = error instanceof ApiClientError ? error.details.attemptsRemaining : undefined;
          setKeyError(
            typeof remaining === "number"
              ? `That key isn’t right. ${remaining} attempt${remaining === 1 ? "" : "s"} left before a temporary lock.`
              : failure.message,
          );
          setShakeId((n) => n + 1);
          setState({ kind: "gate", meta });
        } else {
          setState({ kind: "failed", failure, meta });
        }
      }
    },
    [token],
  );

  // Resolves the landing state without touching React state, so the effect below only sets state asynchronously.
  const fetchMeta = useCallback(async (): Promise<State> => {
    try {
      const { link } = await unwrap(api.share[":token"].$get({ param: { token } }));
      return link.lockedUntil
        ? { kind: "failed", failure: { code: "link_locked", message: "", lockedUntil: link.lockedUntil }, meta: link }
        : { kind: "gate", meta: link };
    } catch (error) {
      return { kind: "failed", failure: toFailure(error) };
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    fetchMeta().then((next) => !cancelled && setState(next));
    return () => {
      cancelled = true;
    };
  }, [fetchMeta]);

  const load = useCallback(() => {
    setState({ kind: "loading" });
    fetchMeta().then(setState);
  }, [fetchMeta]);

  // Public, reusable links open immediately. One-time links wait for an explicit click
  // so link-preview bots and accidental taps can't burn the only view.
  useEffect(() => {
    if (state.kind === "gate" && state.meta.accessType === "public" && state.meta.shareType === "time_based" && !autoOpened.current) {
      autoOpened.current = true;
      void access(state.meta);
    }
  }, [state, access]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-6">
        <Link href="/" aria-label="Cachet">
          <Logo markClassName="size-7" className="[&>span:last-child]:text-2xl" />
        </Link>
        <span className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:inline-flex">
          <ShieldCheck className="text-gold size-3.5" /> Private link · not indexed by search engines
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-5 pb-16">
        {state.kind === "revealed" ? (
            <RevealedNote key="revealed" data={state.data} />
          ) : (
            // CSS (not JS) animation, so the card is visible as soon as the HTML arrives.
            <div key="envelope" className="animate-rise mt-6 w-full max-w-md sm:mt-12">
              <div className="hairline glass relative overflow-hidden rounded-3xl px-6 pt-14 pb-8 text-center sm:px-8">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(22rem_10rem_at_50%_0%,var(--gold-soft),transparent_70%)]" />
                <div className="relative mx-auto -mt-2 mb-6 w-fit">
                  <SealMark
                    className={cn(
                      "size-24",
                      (state.kind === "loading" || state.kind === "unlocking") && "animate-pulse",
                    )}
                  />
                </div>

                {state.kind === "loading" && <p className="text-muted-foreground text-sm">Checking the seal…</p>}

                {(state.kind === "gate" || state.kind === "unlocking") && (
                  <Gate
                    meta={state.meta}
                    busy={state.kind === "unlocking"}
                    keyValue={key}
                    keyError={keyError}
                    shakeId={shakeId}
                    onKeyChange={(v) => {
                      setKey(formatKey(v));
                      setKeyError(null);
                    }}
                    onOpen={() => access(state.meta, state.meta.accessType === "password" ? key : undefined)}
                  />
                )}

                {state.kind === "failed" && <FailureView failure={state.failure} onRetry={load} />}
              </div>
              <p className="text-muted-foreground mt-6 text-center text-xs">
                Want to send notes like this?{" "}
                <Link href="/register" className="text-foreground decoration-gold/50 underline underline-offset-4">
                  Create a free Cachet account
                </Link>
              </p>
            </div>
          )}
      </main>
    </div>
  );
}

function Gate({
  meta,
  busy,
  keyValue,
  keyError,
  shakeId,
  onKeyChange,
  onOpen,
}: {
  meta: Meta;
  busy: boolean;
  keyValue: string;
  keyError: string | null;
  shakeId: number;
  onKeyChange: (v: string) => void;
  onOpen: () => void;
}) {
  const now = useNow(1000);
  const msLeft = new Date(meta.expiresAt).getTime() - now;
  const oneTime = meta.shareType === "one_time";
  const needsKey = meta.accessType === "password";
  const complete = keyValue.replace(/-/g, "").length === 12;

  return (
    <div className="relative">
      <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">A sealed note for you</p>
      <h1 className="font-display mt-2 text-4xl tracking-tight">
        {needsKey ? "Enter the access key" : oneTime ? "Open once, then it’s gone" : "Opening your note…"}
      </h1>

      <div className="text-muted-foreground mt-4 flex flex-wrap justify-center gap-2 text-xs">
        <Chip icon={needsKey ? KeyRound : Globe2}>{needsKey ? "Key-protected" : "Public link"}</Chip>
        <Chip icon={oneTime ? Flame : Clock}>{oneTime ? "One-time view" : "Time-limited"}</Chip>
        <Chip icon={Hourglass}>
          <span className="tabular-nums">{msLeft > 0 ? `${countdown(msLeft)} left` : "Expiring"}</span>
        </Chip>
      </div>

      {oneTime && (
        <p className="border-warning/35 bg-warning/8 mt-5 rounded-xl border px-3.5 py-2.5 text-left text-xs leading-relaxed">
          <span className="font-medium">Heads up:</span> this note can be read only once. As soon as it opens, the link stops working for everyone —
          including you if you refresh.
        </p>
      )}

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && (!needsKey || complete)) onOpen();
        }}
      >
        {needsKey && (
          <div key={shakeId} className={cn(shakeId > 0 && "animate-shake")}>
            <label htmlFor="access-key" className="sr-only">
              Access key
            </label>
            <input
              id="access-key"
              value={keyValue}
              onChange={(e) => onKeyChange(e.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              inputMode="text"
              aria-invalid={!!keyError}
              aria-describedby={keyError ? "key-error" : undefined}
              className={cn(
                "bg-background/50 h-14 w-full rounded-2xl border text-center font-mono text-xl font-semibold tracking-[0.12em] uppercase outline-none transition-colors sm:text-2xl sm:tracking-[0.22em]",
                "placeholder:text-muted-foreground/35 focus-visible:border-gold focus-visible:ring-gold/25 focus-visible:ring-4",
                keyError ? "border-destructive/60" : "border-input",
              )}
            />
            {keyError && (
              <p id="key-error" role="alert" className="text-destructive mt-2 text-xs">
                {keyError}
              </p>
            )}
          </div>
        )}

        {(needsKey || oneTime) && (
          <Button type="submit" variant="gold" size="xl" className="w-full" disabled={busy || (needsKey && !complete)}>
            {busy ? <Loader2 className="animate-spin" /> : needsKey ? <KeyRound /> : <Flame />}
            {busy ? "Breaking the seal…" : needsKey ? "Unlock note" : "Break the seal & read"}
          </Button>
        )}
        {!needsKey && !oneTime && busy && <Loader2 className="text-gold mx-auto size-6 animate-spin" />}
      </form>
    </div>
  );
}

function Chip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="border-border bg-background/40 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
      <Icon className="size-3.5" /> {children}
    </span>
  );
}

function FailureView({ failure, onRetry }: { failure: Failure; onRetry: () => void }) {
  const now = useNow(1000);
  const known = FAILURES[failure.code];
  const Icon = known?.icon ?? Link2Off;
  const lockMs = failure.lockedUntil ? new Date(failure.lockedUntil).getTime() - now : 0;
  const retryable = failure.code === "network" || failure.code === "rate_limited" || failure.code === "internal" || failure.code === "conflict";

  return (
    <div className="relative">
      <span className="bg-muted text-muted-foreground ring-border mx-auto grid size-12 place-items-center rounded-full ring-1">
        <Icon className="size-5" />
      </span>
      <h1 className="font-display mt-4 text-3xl tracking-tight">{known?.title ?? "Something went wrong"}</h1>
      <p className="text-muted-foreground mx-auto mt-2 max-w-xs text-sm leading-relaxed">{known?.body ?? failure.message}</p>

      {failure.code === "link_locked" && (
        <div className="mt-5">
          {lockMs > 0 ? (
            <p className="text-warning font-mono text-2xl tabular-nums">{countdown(lockMs)}</p>
          ) : (
            <Button variant="gold" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}
      {retryable && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

function RevealedNote({ data }: { data: Revealed }) {
  const now = useNow(1000);
  const { note, link } = data;
  const msLeft = new Date(link.expiresAt).getTime() - now;

  return (
    <div className="relative mt-4 w-full max-w-3xl">
      {/* The seal splits in two as the note unfolds. */}
      <div className="pointer-events-none absolute inset-x-0 -top-2 z-20 flex justify-center" aria-hidden>
        {[-1, 1].map((dir) => (
          <div
            key={dir}
            className={cn("absolute", dir < 0 ? "animate-seal-left" : "animate-seal-right")}
            style={{ clipPath: dir < 0 ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)" }}
          >
            <SealMark className="size-24" />
          </div>
        ))}
      </div>

      <article className="hairline bg-card animate-unfold relative overflow-hidden rounded-3xl">
        <div className="via-gold/60 h-px bg-gradient-to-r from-transparent to-transparent" />
        <div className="px-6 pt-10 pb-8 sm:px-12 sm:pt-14">
          <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Shared by {note.sharedBy}</p>
          <h1 className="font-display mt-3 text-4xl leading-tight tracking-tight break-words sm:text-5xl">{note.title}</h1>
          <p className="text-muted-foreground mt-2 text-xs">Last edited {friendlyDate(note.updatedAt)}</p>
          <div className="border-border my-8 border-t" />
          <Markdown>{note.content}</Markdown>
        </div>
        <div className="border-border bg-muted/30 flex flex-wrap items-center gap-3 border-t px-6 py-4 sm:px-12">
          <p className="text-muted-foreground flex-1 text-xs leading-relaxed">
            {link.consumed ? (
              <>
                <Flame className="text-warning mr-1 inline size-3.5" />
                This one-time link has now been used and is sealed forever. Copy anything you need before leaving.
              </>
            ) : msLeft > 0 ? (
              <>
                <Clock className="mr-1 inline size-3.5" />
                This link stops working in <span className="text-foreground tabular-nums">{countdown(msLeft)}</span>.
              </>
            ) : (
              <>
                <TimerOff className="mr-1 inline size-3.5" />
                This link has now expired and won’t open again.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2 print:hidden">
            <CopyButton value={`${note.title}\n\n${note.content}`} label="Copy text" successMessage="Note copied" />
            <Button type="button" variant="outline" size="sm" onClick={() => downloadText(`${slugify(note.title)}.md`, toMarkdown(note))}>
              <FileDown /> Download
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </div>
        </div>
      </article>
    </div>
  );
}
