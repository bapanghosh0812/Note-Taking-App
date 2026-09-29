"use client";

import { FilePlus2, FileText, LogOut, Moon, Settings, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect } from "react";
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

export function CommandMenu({ open, onOpenChange, onSignOut }: { open: boolean; onOpenChange: (o: boolean) => void; onSignOut: () => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { data } = useNotes();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command menu" description="Search notes and actions">
      <CommandInput placeholder="Search notes or jump to…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => router.push("/notes/new"))}>
            <FilePlus2 /> New sealed note
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => router.push("/settings"))}>
            <Settings /> Settings
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
            {resolvedTheme === "dark" ? <Sun /> : <Moon />} Switch to {resolvedTheme === "dark" ? "Ivory" : "Obsidian"} theme
          </CommandItem>
          <CommandItem onSelect={() => run(onSignOut)}>
            <LogOut /> Sign out
          </CommandItem>
        </CommandGroup>
        {!!data?.notes.length && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notes">
              {data.notes.slice(0, 50).map((note) => (
                <CommandItem key={note.id} value={`${note.title} ${note.id}`} onSelect={() => run(() => router.push(`/notes/${note.id}`))}>
                  <FileText /> <span className="truncate">{note.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
