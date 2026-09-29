"use client";

import { useCallback, useRef, useState } from "react";

type Status = "idle" | "streaming" | "done" | "error";

/**
 * Reads a streamed plain-text AI response from our API. The server marks a
 * failure mid-stream with a leading NUL character followed by the message.
 */
export function useAiStream() {
  const [state, setState] = useState<{ status: Status; text: string; error?: string }>({ status: "idle", text: "" });
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (path: string, body: unknown, onChunk?: (text: string) => void): Promise<string | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "streaming", text: "" });
    let acc = "";

    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? "The AI assistant is unavailable right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const failure = acc.indexOf("\u0000");
        if (failure !== -1) throw new Error(acc.slice(failure + 1) || "The AI assistant failed.");
        setState({ status: "streaming", text: acc });
        onChunk?.(acc);
      }
      setState({ status: "done", text: acc.trim() });
      return acc.trim();
    } catch (error) {
      if (controller.signal.aborted) {
        // Stopped by the user: keep whatever arrived so far.
        setState({ status: acc ? "done" : "idle", text: acc.trim() });
        return acc.trim() || null;
      }
      setState({ status: "error", text: "", error: error instanceof Error ? error.message : "AI request failed" });
      return null;
    }
  }, []);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: "idle", text: "" });
  }, []);

  return { ...state, start, stop, reset };
}
