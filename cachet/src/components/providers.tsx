"use client";

import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";

// Loaded after the page is interactive — it renders nothing until the first toast.
const Toaster = dynamic(() => import("@/components/ui/sonner").then((m) => m.Toaster), { ssr: false });

/**
 * Site-wide providers — deliberately tiny, because every public page
 * (landing, sign-in, shared notes) downloads them. Heavier app-only providers
 * live in <AppProviders>, loaded by the signed-in area.
 */
export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange nonce={nonce}>
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}
