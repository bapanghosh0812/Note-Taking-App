import { hc, type ClientResponse } from "hono/client";
import type { AppType } from "@/server/app";

/** Type-safe API client generated from the Hono route definitions. */
export const api = hc<AppType>("/", {
  init: { credentials: "same-origin" },
}).api;

export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  /** Per-field validation messages from a 422 response. */
  get fields(): Record<string, string> {
    return (this.details.fields as Record<string, string>) ?? {};
  }
}

type SuccessBody<R> = R extends ClientResponse<infer T, infer S, "json"> ? (S extends 200 | 201 ? T : never) : never;

/** Awaits a typed request, throwing `ApiClientError` for any non-2xx response. */
export async function unwrap<R extends ClientResponse<unknown, number, "json">>(request: Promise<R>): Promise<SuccessBody<R>> {
  let res: R;
  try {
    res = await request;
  } catch {
    throw new ApiClientError(0, "network", "Network error — check your connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiClientError(res.status, err?.code ?? "unknown", err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return body as SuccessBody<R>;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
