"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server rendering and hydration, true afterwards. Use it to hold
 * back text that depends on the viewer's clock, locale or time zone — the
 * server (UTC on Vercel) would otherwise render different text and break hydration.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
