"use client";

import {
  Archive,
  Bell,
  CircleHelp,
  FilePlus2,
  FileText,
  Home,
  Keyboard,
  Link2,
  LogOut,
  Moon,
  Palette,
  Pin,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useNotes } from "@/hooks/use-notes";
import { useShell } from "./shell-context";

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { openAssistant, openShortcuts, signOut } = useShell();
  const { data } = useNotes();

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  const go = (href: string) => run(() => router.push(href));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command menu" description="Search notes and actions">
      <CommandInput placeholder="Search notes, pages and actions…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go("/notes/new")}>
            <FilePlus2 /> New note <CommandShortcut>Alt N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/notes/new?ai=1")}>
            <Sparkles /> Write a note with AI
          </CommandItem>
          <CommandItem onSelect={() => run(() => openAssistant())}>
            <Sparkles /> Ask the AI assistant <CommandShortcut>Alt A</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
            {resolvedTheme === "dark" ? <Sun /> : <Moon />} Switch to {resolvedTheme === "dark" ? "Ivory" : "Obsidian"} theme
          </CommandItem>
          <CommandItem onSelect={() => run(openShortcuts)}>
            <Keyboard /> Keyboard shortcuts <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => go("/dashboard")}><Home /> Home</CommandItem>
          <CommandItem onSelect={() => go("/notes")}><FileText /> All notes</CommandItem>
          <CommandItem onSelect={() => go("/notes?view=pinned")}><Pin /> Pinned</CommandItem>
          <CommandItem onSelect={() => go("/notes?view=archived")}><Archive /> Archive</CommandItem>
          <CommandItem onSelect={() => go("/trash")}><Trash2 /> Trash</CommandItem>
          <CommandItem onSelect={() => go("/links")}><Link2 /> Share links</CommandItem>
          <CommandItem onSelect={() => go("/notifications")}><Bell /> Notifications</CommandItem>
          <CommandItem onSelect={() => go("/profile")}><UserRound /> Profile</CommandItem>
          <CommandItem onSelect={() => go("/settings")}><Settings /> Settings</CommandItem>
          <CommandItem onSelect={() => go("/settings?tab=appearance")}><Palette /> Appearance</CommandItem>
          <CommandItem onSelect={() => go("/settings?tab=security")}><ShieldCheck /> Security & 2FA</CommandItem>
          <CommandItem onSelect={() => go("/help")}><CircleHelp /> Help center</CommandItem>
        </CommandGroup>
        {!!data?.notes.length && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notes">
              {data.notes.slice(0, 50).map((note) => (
                <CommandItem key={note.id} value={`${note.title} ${note.tags.join(" ")} ${note.id}`} onSelect={() => go(`/notes/${note.id}`)}>
                  <FileText /> <span className="truncate">{note.title}</span>
                  {note.pinned && <Pin className="text-gold ml-auto size-3" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => run(signOut)}>
            <LogOut /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
