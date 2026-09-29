/**
 * Plain constants shared by the browser and the API. Kept free of zod so client
 * components can import them without pulling the schema library into the bundle;
 * the zod schemas in validation.ts / preferences.ts are built from these.
 */

export const LIMITS = {
  titleMax: 200,
  contentMax: 50_000,
  labelMax: 60,
  nameMax: 80,
  passwordMin: 10,
  passwordMax: 128,
  minExpiryMinutes: 2,
  maxExpiryDays: 365,
} as const;

export const NOTE_COLORS = ["none", "amber", "rose", "emerald", "sky", "violet", "slate"] as const;
export const AVATAR_COLORS = ["gold", "rose", "emerald", "sapphire", "amethyst", "slate"] as const;

export const SHARE_TYPES = ["one_time", "time_based"] as const;
export const ACCESS_TYPES = ["public", "password"] as const;
export type ShareType = (typeof SHARE_TYPES)[number];
export type AccessType = (typeof ACCESS_TYPES)[number];

export const AI_ACTIONS = [
  "improve",
  "grammar",
  "shorten",
  "expand",
  "summarize",
  "bulletize",
  "title",
  "continue",
  "action_items",
  "explain",
  "translate",
  "tone",
] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

export const ACCENTS = ["gold", "rose", "emerald", "sapphire", "amethyst", "platinum"] as const;
export const AI_TONES = ["professional", "friendly", "formal", "confident", "casual"] as const;
export const AI_LANGUAGES = ["English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Spanish", "French", "German", "Japanese"] as const;
