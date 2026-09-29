"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiClientError } from "@/lib/api-client";

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            // Don't hammer the API on errors that won't fix themselves.
            retry: (count, error) =>
              count < 2 && !(error instanceof ApiClientError && error.status >= 400 && error.status < 500),
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange nonce={nonce}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={250}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
