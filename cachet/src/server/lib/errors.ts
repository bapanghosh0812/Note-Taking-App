import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "link_invalid"
  | "link_expired"
  | "link_used"
  | "link_revoked"
  | "link_locked"
  | "key_required"
  | "key_invalid"
  | "ai_unavailable"
  | "internal";

/** Thrown anywhere in a request; converted to a JSON error by the app's error handler. */
export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found`);
