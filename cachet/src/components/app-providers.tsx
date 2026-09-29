"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiClientError } from "@/lib/api-client";

/** Data fetching cache and tooltips for the signed-in app. */
export function AppProviders({ children }: { children: React.ReactNode }) {
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
