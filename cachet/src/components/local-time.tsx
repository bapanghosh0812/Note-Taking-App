"use client";

import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Text that depends on the viewer's clock or time zone ("5 minutes ago",
 * "Today, 8:13 PM", live countdowns). The server knows neither — on Vercel it
 * runs in UTC — so this renders nothing on the server and during hydration and
 * fills the text in right after, instead of breaking hydration (React #418).
 */
export function LocalTime({ children }: { children: () => React.ReactNode }) {
  return useHydrated() ? <>{children()}</> : null;
}
