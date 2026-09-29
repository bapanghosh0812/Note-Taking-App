"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useHydrated } from "@/hooks/use-hydrated";

const ORDER = ["dark", "light", "system"] as const;
const LABEL = { dark: "Obsidian", light: "Ivory", system: "System" } as const;

/**
 * One-button theme switcher for public pages (cycles Obsidian → Ivory → System).
 * The in-app menu version uses a Radix dropdown; this one avoids that ~60 KB
 * so the landing, sign-in and share pages load faster.
 */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const current = (hydrated && ORDER.includes(theme as (typeof ORDER)[number]) ? theme : "dark") as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!;
  const Icon = current === "light" ? Sun : current === "system" ? Monitor : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABEL[current]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[current]}`}
      className="text-muted-foreground hover:text-foreground hover:bg-muted inline-grid size-9 place-items-center rounded-lg transition-colors"
    >
      <Icon className="size-4" />
    </button>
  );
}
