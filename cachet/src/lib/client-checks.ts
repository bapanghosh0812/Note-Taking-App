import { LIMITS } from "./constants";

/**
 * Instant form feedback in the browser, mirroring the zod schemas in
 * validation.ts without shipping zod to the client. The API re-validates every
 * request with the full schemas, so these only need to catch honest mistakes.
 * Each function returns field → message; an empty object means "looks valid".
 */

type Errors = Record<string, string>;

const TAG = /^[\p{L}\p{N} _-]+$/u;

export function passwordStrengthError(password: string): string | undefined {
  if (password.length < LIMITS.passwordMin) return `Use at least ${LIMITS.passwordMin} characters`;
  if (password.length > LIMITS.passwordMax) return `Use at most ${LIMITS.passwordMax} characters`;
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number";
}

export function checkNote(note: { title?: string; content?: string; tags?: string[] }): Errors {
  const errors: Errors = {};
  if (note.title !== undefined) {
    if (!note.title.trim()) errors.title = "Give your note a title";
    else if (note.title.trim().length > LIMITS.titleMax) errors.title = `Titles are limited to ${LIMITS.titleMax} characters`;
  }
  if (note.content !== undefined) {
    if (note.content.length > LIMITS.contentMax) errors.content = `Notes are limited to ${LIMITS.contentMax.toLocaleString()} characters`;
    else if (!note.content.trim()) errors.content = "Write something before sealing the note";
  }
  if (note.tags) {
    if (note.tags.length > 10) errors.tags = "Up to 10 tags";
    else if (note.tags.some((t) => !t.trim() || t.trim().length > 24 || !TAG.test(t.trim()))) {
      errors.tags = "Tags can use letters, numbers, spaces, - and _";
    }
  }
  return errors;
}

export function checkShareSettings(settings: { expiresAt: string; label?: string }): Errors {
  const errors: Errors = {};
  const expiry = settings.expiresAt ? new Date(settings.expiresAt).getTime() : NaN;
  if (Number.isNaN(expiry)) errors.expiresAt = "Pick a valid expiry date";
  else if (expiry < Date.now() + (LIMITS.minExpiryMinutes - 1) * 60_000) {
    errors.expiresAt = `Expiry must be at least ${LIMITS.minExpiryMinutes} minutes in the future`;
  } else if (expiry > Date.now() + LIMITS.maxExpiryDays * 86_400_000) {
    errors.expiresAt = `Expiry cannot be more than ${LIMITS.maxExpiryDays} days away`;
  }
  if (settings.label && settings.label.trim().length > LIMITS.labelMax) errors.label = `Labels are limited to ${LIMITS.labelMax} characters`;
  return errors;
}

export function checkPasswordChange(pw: { currentPassword: string; newPassword: string }): Errors {
  const errors: Errors = {};
  if (!pw.currentPassword) errors.currentPassword = "Enter your current password";
  const weak = passwordStrengthError(pw.newPassword);
  if (weak) errors.newPassword = weak;
  return errors;
}
