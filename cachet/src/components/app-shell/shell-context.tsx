"use client";

import { createContext, useContext } from "react";

export type ShellActions = {
  openCommand: () => void;
  openAssistant: (context?: { noteId: string; noteTitle: string }) => void;
  openShortcuts: () => void;
  openFeedback: () => void;
  signOut: () => void;
};

export const ShellContext = createContext<ShellActions | null>(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside the app shell");
  return ctx;
}
