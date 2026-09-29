"use client";

import { useEffect } from "react";
import { SealMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <SealMark className="size-20 opacity-80" />
      <h1 className="font-display mt-8 text-5xl tracking-tight">Something cracked</h1>
      <p className="text-muted-foreground mt-3 max-w-sm text-sm">
        An unexpected error occurred. Your notes are safe — please try again.
        {error.digest && <span className="mt-2 block font-mono text-xs opacity-70">Ref: {error.digest}</span>}
      </p>
      <Button variant="gold" size="lg" className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
