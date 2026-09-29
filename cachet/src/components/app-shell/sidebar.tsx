"use client";

import {
  Archive,
  Bell,
  CircleHelp,
  FilePlus2,
  Hash,
  Home,
  Link2,
  NotebookText,
  Pin,
  Send,
  Settings,
  Share2,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useNotifications, useTags } from "@/hooks/use-notes";
import { cn } from "@/lib/utils";
import { useShell } from "./shell-context";

type Item = { href: string; label: string; icon: LucideIcon; match: (path: string, view: string | null, tag: string | null) => boolean; badge?: number };

export function Sidebar({ user, onNavigate }: { user: { name: string; email: string; avatarColor: string | null; avatarUrl: string | null }; onNavigate?: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view");
  const activeTag = params.get("tag");
  const { data: tagData } = useTags();
  const { data: notifications } = useNotifications();
  const { openFeedback } = useShell();

  const workspace: Item[] = [
    { href: "/dashboard", label: "Home", icon: Home, match: (p) => p === "/dashboard" },
    { href: "/notes", label: "All notes", icon: NotebookText, match: (p, v, t) => (p === "/notes" && !v && !t) || (p.startsWith("/notes/") && p !== "/notes/new") },
    { href: "/notes?view=pinned", label: "Pinned", icon: Pin, match: (p, v) => p === "/notes" && v === "pinned" },
    { href: "/notes?view=shared", label: "Shared", icon: Share2, match: (p, v) => p === "/notes" && v === "shared" },
    { href: "/notes?view=archived", label: "Archive", icon: Archive, match: (p, v) => p === "/notes" && v === "archived" },
    { href: "/trash", label: "Trash", icon: Trash2, match: (p) => p === "/trash" },
  ];
  const manage: Item[] = [
    { href: "/links", label: "Share links", icon: Link2, match: (p) => p === "/links" },
    { href: "/notifications", label: "Notifications", icon: Bell, match: (p) => p === "/notifications", badge: notifications?.unread },
    { href: "/profile", label: "Profile", icon: UserRound, match: (p) => p === "/profile" },
    { href: "/settings", label: "Settings", icon: Settings, match: (p) => p === "/settings" },
  ];

  const renderItem = (item: Item) => {
    const active = item.match(pathname, view, activeTag);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            active ? "bg-gold-soft text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <item.icon className={cn("size-4 shrink-0", active ? "text-gold" : "")} />
          <span className="flex-1 truncate">{item.label}</span>
          {!!item.badge && (
            <span className="bg-gold rounded-full px-1.5 py-px text-[10px] font-semibold text-[oklch(0.2_0.02_70)] tabular-nums">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <Link href="/dashboard" onClick={onNavigate} aria-label="Cachet home">
          <Logo markClassName="size-7" className="[&>span:last-child]:text-2xl" />
        </Link>
      </div>

      <div className="px-3">
        <Button asChild variant="gold" className="h-10 w-full justify-start gap-2 rounded-xl px-3">
          <Link href="/notes/new" onClick={onNavigate}>
            <FilePlus2 /> New note
            <kbd className="ml-auto rounded bg-black/10 px-1.5 font-mono text-[10px]">Alt N</kbd>
          </Link>
        </Button>
      </div>

      <nav className="mt-5 flex-1 space-y-6 overflow-y-auto px-3 pb-4" aria-label="Main">
        <div>
          <p className="text-muted-foreground/70 px-3 pb-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase">Workspace</p>
          <ul className="space-y-0.5">{workspace.map(renderItem)}</ul>
        </div>
        <div>
          <p className="text-muted-foreground/70 px-3 pb-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase">Manage</p>
          <ul className="space-y-0.5">{manage.map(renderItem)}</ul>
        </div>
        {!!tagData?.tags.length && (
          <div>
            <p className="text-muted-foreground/70 px-3 pb-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase">Tags</p>
            <ul className="space-y-0.5">
              {tagData.tags.slice(0, 12).map(({ tag, count }) => (
                <li key={tag}>
                  <Link
                    href={`/notes?tag=${encodeURIComponent(tag)}`}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      activeTag === tag ? "bg-gold-soft text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <Hash className="size-3.5 shrink-0" />
                    <span className="flex-1 truncate">{tag}</span>
                    <span className="text-muted-foreground/70 text-xs tabular-nums">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <div className="border-border/70 space-y-1 border-t px-3 py-3">
        <Link href="/help" onClick={onNavigate} className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors">
          <CircleHelp className="size-4" /> Help center
        </Link>
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            openFeedback();
          }}
          className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
        >
          <Send className="size-4" /> Send feedback
        </button>
        <Link href="/profile" onClick={onNavigate} className="hover:bg-muted/60 mt-1 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors">
          <UserAvatar name={user.name} color={user.avatarColor} src={user.avatarUrl} className="size-8 text-xs" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
          </span>
        </Link>
        <p className="text-muted-foreground/60 flex flex-wrap gap-x-2 px-3 pt-1 text-[11px]">
          <Link href="/terms" className="hover:text-foreground">Terms</Link>·
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>·
          <Link href="/security" className="hover:text-foreground">Security</Link>
        </p>
      </div>
    </div>
  );
}
