import { z } from "zod";
import { ACCENTS, AI_LANGUAGES, AI_TONES } from "./constants";

/**
 * Every user setting lives here — one schema shared by the settings UI and the
 * API, with defaults so older accounts (with fewer stored keys) keep working.
 */

export { ACCENTS, AI_LANGUAGES, AI_TONES } from "./constants";

export const preferencesSchema = z.object({
  // Sharing
  defaultShareType: z.enum(["one_time", "time_based"]),
  defaultAccessType: z.enum(["public", "password"]),
  defaultExpiry: z.enum(["1h", "24h", "7d", "30d"]),
  warnPublicSensitive: z.boolean(),
  // Appearance
  accent: z.enum(ACCENTS),
  fontScale: z.enum(["sm", "md", "lg"]),
  reduceMotion: z.boolean(),
  // Editor
  editorFont: z.enum(["sans", "serif", "mono"]),
  editorView: z.enum(["write", "split", "preview"]),
  spellcheck: z.boolean(),
  autosave: z.boolean(),
  showWordCount: z.boolean(),
  // Notes list
  notesView: z.enum(["grid", "list"]),
  notesSort: z.enum(["updated", "created", "title"]),
  // Notifications
  notifyOnView: z.boolean(),
  notifyOnLock: z.boolean(),
  notifyOnSecurity: z.boolean(),
  // AI
  aiEnabled: z.boolean(),
  aiLanguage: z.enum(AI_LANGUAGES),
  aiTone: z.enum(AI_TONES),
  smartShare: z.boolean(),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  defaultShareType: "time_based",
  defaultAccessType: "password",
  defaultExpiry: "24h",
  warnPublicSensitive: true,
  accent: "gold",
  fontScale: "md",
  reduceMotion: false,
  editorFont: "sans",
  editorView: "write",
  spellcheck: true,
  autosave: true,
  showWordCount: true,
  notesView: "grid",
  notesSort: "updated",
  notifyOnView: true,
  notifyOnLock: true,
  notifyOnSecurity: true,
  aiEnabled: true,
  aiLanguage: "Hindi",
  aiTone: "professional",
  smartShare: true,
};

/** Partial update accepted by PATCH /api/account — unknown keys are stripped. */
export const preferencesPatchSchema = preferencesSchema.partial();

/** Stored JSON may be partial or contain stale values; fall back per key. */
export function resolvePreferences(stored: unknown): Preferences {
  const result = { ...DEFAULT_PREFERENCES };
  if (stored && typeof stored === "object") {
    for (const [key, schema] of Object.entries(preferencesSchema.shape)) {
      const parsed = schema.safeParse((stored as Record<string, unknown>)[key]);
      if (parsed.success) (result as Record<string, unknown>)[key] = parsed.data;
    }
  }
  return result;
}
