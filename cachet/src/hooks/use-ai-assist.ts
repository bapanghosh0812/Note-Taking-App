"use client";

import { useCallback, useRef, useState } from "react";
import type { AiAction } from "@/lib/validation";

type State = { status: "idle" | "streaming" | "done" | "error"; text: string; action: AiAction | null; error?: string };

/**
 * Streams an AI transformation from /api/ai/assist token by token.
 * The server marks a mid-stream failure with a leading NUL character.
 */
export function useAiAssist() {
  const [state, setState] = useState<State>({ status: "idle", text: "", action: null });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async (action: AiAction, text: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "streaming", text: "", action });

    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "The AI assistant is unavailable right now.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const failure = acc.indexOf("\u0000");
        if (failure !== -1) throw new Error(acc.slice(failure + 1) || "The AI assistant failed.");
        setState({ status: "streaming", text: acc, action });
      }
      const final = action === "title" ? acc.trim().replace(/^["'“”]+|["'“”.]+$/g, "") : acc.trim();
      setState({ status: "done", text: final, action });
      return final;
    } catch (error) {
      if (controller.signal.aborted) return null;
      setState({ status: "error", text: "", action, error: error instanceof Error ? error.message : "AI request failed" });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: "idle", text: "", action: null });
  }, []);

  return { ...state, run, reset };
}
