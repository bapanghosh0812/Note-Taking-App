"use client";

import dynamic from "next/dynamic";

/**
 * The Markdown renderer (react-markdown + GFM, ~140 KB) as a separate chunk,
 * downloaded only when a page actually renders Markdown — not with every editor.
 */
export const Markdown = dynamic(() => import("./markdown").then((m) => m.Markdown), {
  loading: () => <div aria-hidden className="bg-muted/60 h-24 animate-pulse rounded-xl" />,
});
