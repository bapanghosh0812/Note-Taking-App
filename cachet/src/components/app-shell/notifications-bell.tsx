"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Eye, Lock, PartyPopper, ShieldAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/hooks/use-notes";
import { api, unwrap } from "@/lib/api-client";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const NOTIFICATION_ICONS: Record<string, LucideIcon> = {
  link_viewed: Eye,
  link_locked: Lock,
  security: ShieldAlert,
  welcome: PartyPopper,
};

export function useNotificationActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const markAll = useMutation({ mutationFn: () => unwrap(api.notifications["read-all"].$post()), onSuccess: refresh });
  const markOne = useMutation({ mutationFn: (id: string) => unwrap(api.notifications[":id"].read.$post({ param: { id } })), onSuccess: refresh });
  const clear = useMutation({ mutationFn: () => unwrap(api.notifications.$delete()), onSuccess: refresh });
  return { markAll, markOne, clear };
}

export function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const { markAll, markOne } = useNotificationActions();
  const unread = data?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="bg-gold ring-background absolute top-1 right-1 grid min-w-4 place-items-center rounded-full px-1 text-[9px] leading-4 font-bold text-[oklch(0.2_0.02_70)] ring-2">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="border-border flex items-center justify-between border-b px-4 py-3">
          <p className="font-display text-xl">Notifications</p>
          <Button variant="ghost" size="xs" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {!data?.notifications.length ? (
            <li className="text-muted-foreground px-4 py-10 text-center text-sm">You’re all caught up.</li>
          ) : (
            data.notifications.slice(0, 8).map((n) => {
              const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) markOne.mutate(n.id);
                      setOpen(false);
                      if (n.href) router.push(n.href);
                    }}
                    className={cn("hover:bg-muted/50 flex w-full gap-3 px-4 py-3 text-left transition-colors", !n.read && "bg-gold-soft/40")}
                  >
                    <span className={cn("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", n.type === "link_locked" || n.type === "security" ? "bg-warning/15 text-warning" : "bg-gold-soft text-gold")}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug font-medium">{n.title}</span>
                      {n.body && <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs">{n.body}</span>}
                      <span className="text-muted-foreground/80 mt-1 block text-[11px]">{relativeTime(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="bg-gold mt-2 size-2 shrink-0 rounded-full" aria-label="Unread" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-border border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
            <Link href="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
