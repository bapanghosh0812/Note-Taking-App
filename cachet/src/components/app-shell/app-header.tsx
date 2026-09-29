"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FilePlus2, LogOut, Search, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, unwrap } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { CommandMenu } from "./command-menu";

export type HeaderUser = { name: string; email: string };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function AppHeader({ user }: { user: HeaderUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [commandOpen, setCommandOpen] = useState(false);

  const signOut = useCallback(async () => {
    try {
      await unwrap(api.auth.logout.$post());
    } finally {
      queryClient.clear();
      toast.success("Signed out. Your notes stay sealed.");
      router.replace("/login");
      router.refresh();
    }
  }, [queryClient, router]);

  const nav = [
    { href: "/notes", label: "Notes" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <header className="border-border/60 glass sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/notes" className="shrink-0" aria-label="Cachet home">
          <Logo markClassName="size-7" className="[&>span:last-child]:text-2xl" />
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                pathname === item.href || (item.href === "/notes" && pathname.startsWith("/notes/") && pathname !== "/notes/new")
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCommandOpen(true)}
            className="text-muted-foreground hidden h-9 w-56 justify-start gap-2 rounded-xl sm:flex"
          >
            <Search className="size-3.5" />
            <span className="text-sm">Search notes…</span>
            <kbd className="bg-muted ml-auto rounded-md px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
          </Button>
          <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setCommandOpen(true)} aria-label="Search">
            <Search className="size-4" />
          </Button>
          <ThemeToggle />
          <Button asChild variant="gold" size="sm" className="hidden h-9 rounded-xl px-3.5 sm:inline-flex">
            <Link href="/notes/new">
              <FilePlus2 /> New note
            </Link>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus-visible:ring-ring ml-1 rounded-full outline-none focus-visible:ring-2" aria-label="Account menu">
                <Avatar className="ring-gold/40 size-9 ring-1">
                  <AvatarFallback className="bg-gold-soft text-gold font-display text-base">{initials(user.name)}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="text-muted-foreground truncate text-xs">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="sm:hidden">
                <Link href="/notes/new">
                  <FilePlus2 /> New note
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut} variant="destructive">
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} onSignOut={signOut} />
    </header>
  );
}
