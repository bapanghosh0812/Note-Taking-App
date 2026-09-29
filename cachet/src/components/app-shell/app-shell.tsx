"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleHelp, Keyboard, LogOut, Menu, Search, Send, Settings, Sparkles, UserRound } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user-avatar";
import { useOpenedOnce } from "@/hooks/use-opened-once";
import { PreferencesProvider } from "@/hooks/use-preferences";
import { api, unwrap } from "@/lib/api-client";
import type { Preferences } from "@/lib/preferences";
import { NotificationsBell } from "./notifications-bell";
import { ShellContext, type ShellActions } from "./shell-context";
import { Sidebar } from "./sidebar";

// Overlays are downloaded the first time they are opened, not with every page.
const CommandMenu = dynamic(() => import("./command-menu").then((m) => m.CommandMenu), { ssr: false });
const AiAssistant = dynamic(() => import("./ai-assistant").then((m) => m.AiAssistant), { ssr: false });
const ShortcutsDialog = dynamic(() => import("./dialogs").then((m) => m.ShortcutsDialog), { ssr: false });
const FeedbackDialog = dynamic(() => import("./dialogs").then((m) => m.FeedbackDialog), { ssr: false });

export type ShellUser = {
  name: string;
  email: string;
  avatarColor: string | null;
  avatarUrl: string | null;
};

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function AppShell({ user, preferences, children }: { user: ShellUser; preferences: Preferences; children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileNav, setMobileNav] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [assistant, setAssistant] = useState<{
    open: boolean;
    note?: { noteId: string; noteTitle: string };
  }>({ open: false });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const commandLoaded = useOpenedOnce(commandOpen);
  const assistantLoaded = useOpenedOnce(assistant.open);
  const shortcutsLoaded = useOpenedOnce(shortcutsOpen);
  const feedbackLoaded = useOpenedOnce(feedbackOpen);

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

  const actions = useMemo<ShellActions>(
    () => ({
      openCommand: () => setCommandOpen(true),
      openAssistant: (note) => setAssistant({ open: true, note }),
      openShortcuts: () => setShortcutsOpen(true),
      openFeedback: () => setFeedbackOpen(true),
      signOut,
    }),
    [signOut],
  );

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      } else if (e.altKey && e.code === "KeyN") {
        e.preventDefault();
        router.push("/notes/new");
      } else if (e.altKey && e.code === "KeyA") {
        e.preventDefault();
        setAssistant((a) => ({ ...a, open: true }));
      } else if (e.key === "?" && !mod && !isTyping(e.target)) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <PreferencesProvider initial={preferences}>
      <ShellContext.Provider value={actions}>
        <div className="flex min-h-dvh">
          {/* Desktop sidebar */}
          <aside className="border-border/60 bg-card fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block">
            <Sidebar user={user} />
          </aside>

          {/* Mobile sidebar */}
          <Sheet open={mobileNav} onOpenChange={setMobileNav}>
            <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Sidebar user={user} onNavigate={() => setMobileNav(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
            <header className="border-border/60 glass sticky top-0 z-20 border-b">
              <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
                  <Menu className="size-5" />
                </Button>

                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="border-input text-muted-foreground hover:text-foreground hover:border-foreground/20 flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 text-sm transition-colors sm:max-w-md"
                >
                  <Search className="size-4 shrink-0" />
                  <span className="truncate">Search notes, pages, actions…</span>
                  <kbd className="bg-muted ml-auto hidden rounded-md px-1.5 py-0.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
                </button>

                <div className="ml-auto flex items-center gap-1">
                  <Button variant="outline" size="sm" className="border-gold/40 hidden h-9 rounded-xl sm:inline-flex" onClick={() => setAssistant((a) => ({ ...a, open: true }))}>
                    <Sparkles className="text-gold" /> Ask AI
                  </Button>
                  <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setAssistant((a) => ({ ...a, open: true }))} aria-label="Ask AI">
                    <Sparkles className="text-gold size-4" />
                  </Button>
                  <NotificationsBell />
                  <ThemeSwitch />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="focus-visible:ring-ring ml-1 rounded-full outline-none focus-visible:ring-2" aria-label="Account menu">
                        <UserAvatar name={user.name} color={user.avatarColor} src={user.avatarUrl} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuLabel className="font-normal">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/profile">
                          <UserRound /> Profile
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings">
                          <Settings /> Settings
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
                        <Keyboard /> Keyboard shortcuts
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/help">
                          <CircleHelp /> Help center
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setFeedbackOpen(true)}>
                        <Send /> Send feedback
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={signOut} variant="destructive">
                        <LogOut /> Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>

            {/* Deliberately no <Suspense> in the shell: React streams large boundaries at the end
                of the HTML and reveals them later with a script, delaying the first paint. */}
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>

            <footer className="border-border/60 text-muted-foreground border-t">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-5 text-xs sm:px-6">
                <span>© {new Date().getFullYear()} Cachet</span>
                <Link href="/terms" className="hover:text-foreground">
                  Terms
                </Link>
                <Link href="/privacy" className="hover:text-foreground">
                  Privacy
                </Link>
                <Link href="/security" className="hover:text-foreground">
                  Security
                </Link>
                <Link href="/help" className="hover:text-foreground">
                  Help
                </Link>
                <button type="button" onClick={() => setShortcutsOpen(true)} className="hover:text-foreground">
                  Shortcuts
                </button>
                <span className="ml-auto">Private notes · sealed links</span>
              </div>
            </footer>
          </div>
        </div>

        {commandLoaded && <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />}
        {assistantLoaded && (
          <AiAssistant
            open={assistant.open}
            note={assistant.note}
            onOpenChange={(open) => setAssistant((a) => ({ ...a, open }))}
            onClearNote={() => setAssistant((a) => ({ ...a, note: undefined }))}
          />
        )}
        {shortcutsLoaded && <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />}
        {feedbackLoaded && <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />}
      </ShellContext.Provider>
    </PreferencesProvider>
  );
}
