import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url().optional(),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  // Protects the scheduled cleanup endpoint (Vercel Cron sends it as a Bearer token).
  CRON_SECRET: z.string().min(16).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/**
 * Validated environment. Parsed lazily (not at import time) so `next build`
 * can collect route metadata without production secrets being present.
 */
export function env(): Env {
  if (cached) return cached;
  // Treat blank variables (e.g. `APP_URL=`) as unset instead of failing validation.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ""));
  // On Vercel, fall back to the production domain when APP_URL isn't configured.
  if (!raw.APP_URL && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    raw.APP_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n  ${issues.join("\n  ")}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";
