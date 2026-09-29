import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";
import { ApiError } from "./lib/errors";

/**
 * zod-backed request validation. Failures become a consistent 422 response
 * with one message per field, e.g. `{ fields: { "share.expiresAt": "..." } }`.
 */
export const validate = <Target extends keyof ValidationTargets, Schema extends ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join(".") || "_";
        fields[key] ??= issue.message;
      }
      const first = Object.values(fields)[0] ?? "Invalid input";
      throw new ApiError(422, "validation_failed", first, { fields });
    }
  });
