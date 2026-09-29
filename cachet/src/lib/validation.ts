import { z } from "zod";
import { ACCESS_TYPES, AI_ACTIONS, AI_LANGUAGES, AI_TONES, AVATAR_COLORS, LIMITS, NOTE_COLORS, SHARE_TYPES } from "./constants";

/**
 * Validation schemas shared by the browser (form feedback) and the API
 * (the source of truth — the server never trusts client-side validation).
 */

export { ACCESS_TYPES, AI_ACTIONS, AVATAR_COLORS, LIMITS, NOTE_COLORS, SHARE_TYPES } from "./constants";
export type { AccessType, AiAction, ShareType } from "./constants";

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
  acceptTerms: z.literal(true, { error: "Please accept the Terms and Privacy Policy" }),
});

export const loginSchema = z.object({
  email,
  // No strength rules on login — only on creation — so old passwords still work.
  password: z.string().min(1, "Enter your password").max(LIMITS.passwordMax),
});

export const twoFactorLoginSchema = z.object({
  ticket: z.string().min(10).max(300),
  code: z.string().trim().min(6, "Enter the 6-digit code").max(12),
});

export const totpCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your app"),
});

export const shareTypeSchema = z.enum(SHARE_TYPES);
export const accessTypeSchema = z.enum(ACCESS_TYPES);

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

const tags = z
  .array(z.string().trim().toLowerCase().min(1).max(24).regex(/^[\p{L}\p{N} _-]+$/u, "Tags can use letters, numbers, spaces, - and _"))
  .max(10, "Up to 10 tags")
  .transform((list) => [...new Set(list)]);
const content = z
  .string()
  .max(LIMITS.contentMax, `Notes are limited to ${LIMITS.contentMax.toLocaleString()} characters`)
  .refine((v) => v.trim().length > 0, "Write something before sealing the note");

export const createNoteSchema = z.object({
  title,
  content,
  tags: tags.optional(),
  color: z.enum(NOTE_COLORS).optional(),
  pinned: z.boolean().optional(),
  // Optional so notes can also be saved privately and shared later.
  share: shareSettingsSchema.optional(),
});

export const updateNoteSchema = z
  .object({
    title: title.optional(),
    content: content.optional(),
    tags: tags.optional(),
    color: z.enum(NOTE_COLORS).optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to update");

export const extendLinkSchema = z.object({
  expiresAt: shareSettingsSchema.shape.expiresAt,
});

export const feedbackSchema = z.object({
  kind: z.enum(["idea", "bug", "praise", "question"]),
  message: z.string().trim().min(5, "Tell us a little more").max(2000),
  page: z.string().max(200).optional(),
});

export const unlockSchema = z.object({
  key: z.string().max(64).optional(),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.nameMax).optional(),
  bio: z.string().trim().max(160).optional(),
  avatarColor: z.enum(AVATAR_COLORS).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(LIMITS.passwordMax),
  newPassword: password,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your password").max(LIMITS.passwordMax),
});

export const aiActions = AI_ACTIONS;
export const aiAssistSchema = z.object({
  action: z.enum(aiActions),
  text: z.string().trim().min(1, "Write something first").max(20_000),
  language: z.enum(AI_LANGUAGES).optional(),
  tone: z.enum(AI_TONES).optional(),
});

export const aiGenerateSchema = z.object({
  prompt: z.string().trim().min(3, "Describe what you want to write").max(2000),
  format: z.enum(["note", "checklist", "meeting", "email", "plan"]).default("note"),
});

export const aiTextSchema = z.object({
  title: z.string().max(LIMITS.titleMax).optional(),
  text: z.string().trim().min(1, "Write something first").max(20_000),
});

export const aiChatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(24),
  noteId: z.string().uuid().optional(),
});

export type ShareSettings = z.infer<typeof shareSettingsSchema>;
