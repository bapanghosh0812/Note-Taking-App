import { z } from "zod";

/**
 * Validation schemas shared by the browser (form feedback) and the API
 * (the source of truth — the server never trusts client-side validation).
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

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("Enter a valid email address");

const password = z
  .string()
  .min(LIMITS.passwordMin, `Use at least ${LIMITS.passwordMin} characters`)
  .max(LIMITS.passwordMax, `Use at most ${LIMITS.passwordMax} characters`)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Include at least one letter and one number");

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(LIMITS.nameMax),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  // No strength rules on login — only on creation — so old passwords still work.
  password: z.string().min(1, "Enter your password").max(LIMITS.passwordMax),
});

export const shareTypeSchema = z.enum(["one_time", "time_based"]);
export const accessTypeSchema = z.enum(["public", "password"]);

export const shareSettingsSchema = z.object({
  shareType: shareTypeSchema,
  accessType: accessTypeSchema,
  expiresAt: z.coerce
    .date({ error: "Pick a valid expiry date" })
    .refine((d) => d.getTime() >= Date.now() + (LIMITS.minExpiryMinutes - 1) * 60_000, {
      message: `Expiry must be at least ${LIMITS.minExpiryMinutes} minutes in the future`,
    })
    .refine((d) => d.getTime() <= Date.now() + LIMITS.maxExpiryDays * 86_400_000, {
      message: `Expiry cannot be more than ${LIMITS.maxExpiryDays} days away`,
    }),
  label: z.string().trim().max(LIMITS.labelMax).optional().transform((v) => v || undefined),
});

const title = z.string().trim().min(1, "Give your note a title").max(LIMITS.titleMax);
const content = z
  .string()
  .max(LIMITS.contentMax, `Notes are limited to ${LIMITS.contentMax.toLocaleString()} characters`)
  .refine((v) => v.trim().length > 0, "Write something before sealing the note");

export const createNoteSchema = z.object({
  title,
  content,
  share: shareSettingsSchema,
});

export const updateNoteSchema = z
  .object({ title: title.optional(), content: content.optional() })
  .refine((v) => v.title !== undefined || v.content !== undefined, "Nothing to update");

export const unlockSchema = z.object({
  key: z.string().max(64).optional(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.nameMax).optional(),
  preferences: z
    .object({
      defaultShareType: shareTypeSchema.optional(),
      defaultAccessType: accessTypeSchema.optional(),
      defaultExpiry: z.enum(["1h", "24h", "7d", "30d"]).optional(),
      aiEnabled: z.boolean().optional(),
    })
    .optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(LIMITS.passwordMax),
  newPassword: password,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password").max(LIMITS.passwordMax),
});

export const aiActions = ["improve", "summarize", "title", "grammar", "shorten", "expand", "bulletize"] as const;
export const aiAssistSchema = z.object({
  action: z.enum(aiActions),
  text: z.string().trim().min(1, "Write something first").max(20_000),
});

export type ShareType = z.infer<typeof shareTypeSchema>;
export type AccessType = z.infer<typeof accessTypeSchema>;
export type ShareSettings = z.infer<typeof shareSettingsSchema>;
export type AiAction = (typeof aiActions)[number];
