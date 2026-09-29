import { passwordStrengthError } from "./client-checks";

/**
 * Instant client-side feedback for the sign-in / sign-up forms.
 * Kept free of zod on purpose so these public pages stay light; the API
 * re-validates everything with the full zod schemas in src/lib/validation.ts.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkAuthInput(
  mode: "login" | "register",
  v: { name: string; email: string; password: string; acceptTerms?: boolean },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (mode === "register" && !v.name.trim()) errors.name = "Tell us your name";
  if (!EMAIL.test(v.email.trim())) errors.email = "Enter a valid email address";
  if (mode === "login") {
    if (!v.password) errors.password = "Enter your password";
  } else {
    const weak = passwordStrengthError(v.password);
    if (weak) errors.password = weak;
    if (!v.acceptTerms) errors.acceptTerms = "Please accept the Terms and Privacy Policy";
  }
  return errors;
}
