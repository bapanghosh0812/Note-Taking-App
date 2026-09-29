"use client";

import { Activity, Ban, Clock, Eye, Flame, Globe2, KeyRound, MoreHorizontal, RefreshCw } from "lucide-react";
import { useState } from "react";
import { StatusBadge, type LinkStatus } from "@/components/status-badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNow } from "@/hooks/use-now";
import { countdown, friendlyDate, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export type OwnerLink = {
  id: string;
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
function liveStatus(link: OwnerLink, now: number): LinkStatus {
  if (link.revokedAt) return "revoked";
  if (link.consumedAt) return "used";
  if (new Date(link.expiresAt).getTime() <= now) return "expired";
  if (link.lockedUntil && new Date(link.lockedUntil).getTime() > now) return "locked";
  return "active";
}

export function LinkCard({
  link,
  onRevoke,
  onRegenerate,
  onActivity,
  busy,
}: {
  link: OwnerLink;
  onRevoke: () => void;
  onRegenerate: () => void;
  onActivity: () => void;
  busy?: boolean;
}) {
  const now = useNow(1000);
  const [confirm, setConfirm] = useState<"revoke" | "regenerate" | null>(null);
  const status = liveStatus(link, now);
  const active = status === "active" || status === "locked";
  const msLeft = new Date(link.expiresAt).getTime() - now;
  const AccessIcon = link.accessType === "password" ? KeyRound : Globe2;

  return (
    <div
      className={cn(
        "hairline bg-card group relative flex flex-col gap-4 rounded-2xl p-4 transition-opacity sm:flex-row sm:items-center sm:p-5",
        !active && "opacity-70",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl ring-1",
            active ? "bg-gold-soft text-gold ring-gold/30" : "bg-muted text-muted-foreground ring-border",
          )}
        >
          <AccessIcon className="size-5" />
        </span>
        <div className="min-w-0">
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
            <span title={friendlyDate(link.expiresAt)}>
              {status === "revoked"
                ? `Revoked ${relativeTime(link.revokedAt!)}`
                : status === "used"
                  ? `Opened ${relativeTime(link.consumedAt!)}`
                  : status === "expired"
                    ? `Expired ${relativeTime(link.expiresAt)}`
                    : (
                      <span className={cn("tabular-nums", msLeft < 10 * 60_000 && "text-warning")}>
                        Expires in {countdown(msLeft)}
                      </span>
                    )}
            </span>
            {status === "locked" && link.lockedUntil && (
              <span className="text-warning">Locked after wrong keys · {countdown(new Date(link.lockedUntil).getTime() - now)}</span>
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

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">
              {confirm === "revoke" ? "Revoke this link?" : "Issue a new access key?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "revoke"
                ? "Every attempt to open it from now on is refused — even from someone who already has the link page open. This cannot be undone, but you can always create a new link."
                : "The current key stops working immediately and any lockout is cleared. You will see the new key once."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm === "revoke" ? "destructive" : "default"}
              onClick={() => (confirm === "revoke" ? onRevoke() : onRegenerate())}
            >
              {confirm === "revoke" ? "Revoke link" : "Issue new key"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
