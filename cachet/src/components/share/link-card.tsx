"use client";

import { Activity, Ban, CalendarPlus, Clock, Eye, FileText, Flame, Globe2, KeyRound, MoreHorizontal, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LocalTime } from "@/components/local-time";
import { StatusBadge, type LinkStatus } from "@/components/status-badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useNow } from "@/hooks/use-now";
import { toLocalInputValue } from "@/lib/expiry";
import { countdown, friendlyDate, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type OwnerLink = {
  id: string;
  noteId: string;
  label: string | null;
  tokenPrefix: string;
  shareType: "one_time" | "time_based";
  accessType: "public" | "password";
  status: LinkStatus;
  expiresAt: string;
  consumedAt: string | null;
  revokedAt: string | null;
  lockedUntil: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
};

/** Status recomputed on the client each second so expiry flips live without a refetch. */
export function liveStatus(link: OwnerLink, now: number): LinkStatus {
  if (link.revokedAt) return "revoked";
  if (link.consumedAt) return "used";
  if (new Date(link.expiresAt).getTime() <= now) return "expired";
  if (link.lockedUntil && new Date(link.lockedUntil).getTime() > now) return "locked";
  return "active";
}

const EXTEND_OPTIONS = [
  { label: "+1 hour", ms: 3_600_000 },
  { label: "+24 hours", ms: 86_400_000 },
  { label: "+7 days", ms: 7 * 86_400_000 },
  { label: "+30 days", ms: 30 * 86_400_000 },
];

function ExtendDialog({ link, open, onOpenChange, onExtend }: { link: OwnerLink; open: boolean; onOpenChange: (o: boolean) => void; onExtend: (iso: string) => void }) {
  const now = useNow(30_000);
  const [custom, setCustom] = useState("");
  const base = Math.max(now, new Date(link.expiresAt).getTime());
  const submit = (date: Date) => {
    onExtend(date.toISOString());
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">Change expiry</DialogTitle>
          <DialogDescription>Currently expires {friendlyDate(link.expiresAt)}. Extensions are added to the current expiry.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {EXTEND_OPTIONS.map((o) => (
            <Button key={o.label} variant="outline" onClick={() => submit(new Date(base + o.ms))}>
              {o.label}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">Or pick an exact date and time</p>
          <div className="flex gap-2">
            <Input type="datetime-local" value={custom} min={toLocalInputValue(new Date(now + 2 * 60_000))} onChange={(e) => setCustom(e.target.value)} aria-label="New expiry" />
            <Button variant="gold" disabled={!custom} onClick={() => submit(new Date(custom))}>
              Set
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LinkCard({
  link,
  noteTitle,
  onRevoke,
  onRegenerate,
  onExtend,
  onActivity,
  busy,
}: {
  link: OwnerLink;
  noteTitle?: string;
  onRevoke: () => void;
  onRegenerate: () => void;
  onExtend: (expiresAt: string) => void;
  onActivity: () => void;
  busy?: boolean;
}) {
  const now = useNow(1000);
  const [confirm, setConfirm] = useState<"revoke" | "regenerate" | null>(null);
  const [extendOpen, setExtendOpen] = useState(false);
  const status = liveStatus(link, now);
  const active = status === "active" || status === "locked";
  const msLeft = new Date(link.expiresAt).getTime() - now;
  const AccessIcon = link.accessType === "password" ? KeyRound : Globe2;

  return (
    <div className={cn("hairline bg-card group relative flex flex-col gap-4 rounded-2xl p-4 transition-opacity sm:flex-row sm:items-center sm:p-5", !active && "opacity-70")}>
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1", active ? "bg-gold-soft text-gold ring-gold/30" : "bg-muted text-muted-foreground ring-border")}>
          <AccessIcon className="size-5" />
        </span>
        <div className="min-w-0">
          {noteTitle && (
            <Link href={`/notes/${link.noteId}`} className="text-muted-foreground hover:text-foreground mb-0.5 inline-flex max-w-full items-center gap-1 text-xs">
              <FileText className="size-3 shrink-0" /> <span className="truncate">{noteTitle}</span>
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{link.label || `Link ·${link.tokenPrefix}…`}</p>
            <StatusBadge status={status} />
          </div>
          <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1">
              {link.shareType === "one_time" ? <Flame className="size-3.5" /> : <Clock className="size-3.5" />}
              {link.shareType === "one_time" ? "One-time" : "Time-based"}
            </span>
            <span>{link.accessType === "password" ? "Key-protected" : "Public"}</span>
            <LocalTime>
              {() => (
                <span title={friendlyDate(link.expiresAt)}>
                  {status === "revoked" ? (
                    `Revoked ${relativeTime(link.revokedAt!)}`
                  ) : status === "used" ? (
                    `Opened ${relativeTime(link.consumedAt!)}`
                  ) : status === "expired" ? (
                    `Expired ${relativeTime(link.expiresAt)}`
                  ) : (
                    <span className={cn("tabular-nums", msLeft < 10 * 60_000 && "text-warning")}>Expires in {countdown(msLeft)}</span>
                  )}
                </span>
              )}
            </LocalTime>
            {status === "locked" && link.lockedUntil && (
              <span className="text-warning">
                Locked after wrong keys · <LocalTime>{() => countdown(new Date(link.lockedUntil!).getTime() - now)}</LocalTime>
              </span>
            )}
            {link.lastViewedAt && (
              <span>
                Last opened <LocalTime>{() => relativeTime(link.lastViewedAt!)}</LocalTime>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="text-right">
          <p className="text-2xl leading-none font-semibold tabular-nums">{link.viewCount}</p>
          <p className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-[11px] tracking-wide uppercase">
            <Eye className="size-3" /> {link.viewCount === 1 ? "view" : "views"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {active && (
            <Button variant="outline" size="sm" onClick={() => setConfirm("revoke")} disabled={busy} className="hover:border-destructive/40 hover:text-destructive">
              <Ban /> Revoke
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={onActivity}>
                <Activity /> View activity
              </DropdownMenuItem>
              {status === "active" && (
                <DropdownMenuItem onSelect={() => setExtendOpen(true)}>
                  <CalendarPlus /> Change expiry
                </DropdownMenuItem>
              )}
              {active && link.accessType === "password" && (
                <DropdownMenuItem onSelect={() => setConfirm("regenerate")}>
                  <RefreshCw /> Issue new key
                </DropdownMenuItem>
              )}
              {active && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirm("revoke")}>
                    <Ban /> Revoke link
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ExtendDialog link={link} open={extendOpen} onOpenChange={setExtendOpen} onExtend={onExtend} />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">{confirm === "revoke" ? "Revoke this link?" : "Issue a new access key?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "revoke"
                ? "Every attempt to open it from now on is refused — even from someone who already has the link page open. This cannot be undone, but you can always create a new link."
                : "The current key stops working immediately and any lockout is cleared. You will see the new key once."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant={confirm === "revoke" ? "destructive" : "default"} onClick={() => (confirm === "revoke" ? onRevoke() : onRegenerate())}>
              {confirm === "revoke" ? "Revoke link" : "Issue new key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
