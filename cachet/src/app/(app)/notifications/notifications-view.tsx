"use client";

import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { LocalTime } from "@/components/local-time";
import { NOTIFICATION_ICONS, useNotificationActions } from "@/components/app-shell/notifications-bell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/use-notes";
import { friendlyDate, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationsView() {
  const router = useRouter();
  const { data, isLoading } = useNotifications();
  const { markAll, markOne, clear } = useNotificationActions();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Inbox</p>
          <h1 className="font-display mt-2 text-5xl tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-2 text-sm">Link opens, brute-force lockouts and security alerts. Choose what you get in Settings → Notifications.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!data?.unread} onClick={() => markAll.mutate()}>
            <CheckCheck /> Mark all read
          </Button>
          <Button variant="ghost" disabled={!data?.notifications.length} onClick={() => clear.mutate()}>
            <Trash2 /> Clear
          </Button>
        </div>
      </div>

      <div className="hairline bg-card mt-8 overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : !data?.notifications.length ? (
          <div className="text-muted-foreground px-6 py-20 text-center text-sm">
            <Bell className="mx-auto mb-3 size-8 opacity-50" />
            No notifications yet.
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {data.notifications.map((n) => {
              const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) markOne.mutate(n.id);
                      if (n.href) router.push(n.href);
                    }}
                    className={cn("hover:bg-muted/40 flex w-full gap-4 px-5 py-4 text-left transition-colors", !n.read && "bg-gold-soft/30")}
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full",
                        n.type === "link_locked" || n.type === "security" ? "bg-warning/15 text-warning" : "bg-gold-soft text-gold",
                      )}
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{n.title}</span>
                        {!n.read && <span className="bg-gold size-2 rounded-full" aria-label="Unread" />}
                      </span>
                      {n.body && <span className="text-muted-foreground mt-0.5 block text-sm">{n.body}</span>}
                      <time className="text-muted-foreground/80 mt-1 block min-h-4 text-xs" dateTime={n.createdAt}>
                        <LocalTime>{() => <span title={friendlyDate(n.createdAt)}>{relativeTime(n.createdAt)}</span>}</LocalTime>
                      </time>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
