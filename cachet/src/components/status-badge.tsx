import { Ban, CheckCircle2, Clock, Hourglass, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type LinkStatus = "active" | "used" | "expired" | "revoked" | "locked";

const STYLES: Record<LinkStatus, { label: string; icon: LucideIcon; className: string }> = {
  active: { label: "Active", icon: CheckCircle2, className: "bg-success/12 text-success ring-success/25" },
  used: { label: "Opened", icon: Hourglass, className: "bg-muted text-muted-foreground ring-border" },
  expired: { label: "Expired", icon: Clock, className: "bg-muted text-muted-foreground ring-border" },
  revoked: { label: "Revoked", icon: Ban, className: "bg-destructive/10 text-destructive ring-destructive/25" },
  locked: { label: "Locked", icon: Lock, className: "bg-warning/12 text-warning ring-warning/30" },
};

export function StatusBadge({ status, className }: { status: LinkStatus; className?: string }) {
  const { label, icon: Icon, className: tone } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase ring-1 ring-inset",
        tone,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
