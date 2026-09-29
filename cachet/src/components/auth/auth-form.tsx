"use client";

import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, api, unwrap } from "@/lib/api-client";
import { safeRedirect } from "@/lib/safe-redirect";
import { checkAuthInput } from "@/lib/auth-checks";
import { PasswordInput, PasswordStrength } from "./password-input";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set when the password was right but the account needs a 2FA code.
  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const isRegister = mode === "register";
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((errs) => ({ ...errs, [key]: "" }));
  };

  const finish = () => {
    router.replace(safeRedirect(searchParams.get("next")));
    router.refresh();
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const fieldErrors = checkAuthInput(mode, { ...values, acceptTerms });
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }
    const email = values.email.trim().toLowerCase();

    setPending(true);
    try {
      if (isRegister) {
        const name = values.name.trim();
        await unwrap(api.auth.register.$post({ json: { name, email, password: values.password, acceptTerms: true } }));
        toast.success(`Welcome to Cachet, ${name.split(" ")[0]}`);
        return finish();
      }
      const res = await unwrap(api.auth.login.$post({ json: { email, password: values.password } }));
      if (res.mfaRequired && res.ticket) {
        setTicket(res.ticket);
        setPending(false);
        return;
      }
      finish();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fields).length) setErrors(error.fields);
      setFormError(error instanceof ApiClientError ? error.message : "Something went wrong. Please try again.");
      setPending(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket || code.trim().length < 6) return;
    setFormError(null);
    setPending(true);
    try {
      await unwrap(api.auth.login["2fa"].$post({ json: { ticket, code } }));
      finish();
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "Something went wrong. Please try again.");
      if (error instanceof ApiClientError && error.message.includes("expired")) setTicket(null);
      setPending(false);
    }
  }

  if (ticket) {
    return (
      <div>
        <span className="bg-gold-soft text-gold grid size-12 place-items-center rounded-2xl">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="font-display mt-5 text-4xl tracking-tight">Two-step verification</h1>
        <p className="text-muted-foreground mt-2 text-sm">Enter the 6-digit code from your authenticator app, or one of your backup codes.</p>
        <form onSubmit={onVerify} className="mt-8 space-y-5" noValidate>
          {formError && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 9))}
            inputMode="text"
            autoComplete="one-time-code"
            autoFocus
            placeholder="123456"
            aria-label="Verification code"
            className="h-14 text-center font-mono text-2xl tracking-[0.35em]"
          />
          <Button type="submit" variant="gold" size="xl" className="w-full" disabled={pending || code.trim().length < 6}>
            {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify & sign in
          </Button>
          <button
            type="button"
            onClick={() => {
              setTicket(null);
              setCode("");
              setFormError(null);
            }}
            className="text-muted-foreground hover:text-foreground mx-auto flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="size-4" /> Use a different account
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-4xl tracking-tight">{isRegister ? "Create your account" : "Welcome back"}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {isRegister ? "Private notes, sealed links. Free, and ready in seconds." : "Sign in to your sealed notes."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        {formError && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {isRegister && (
          <FormField id="name" label="Full name" error={errors.name}>
            <Input id="name" autoComplete="name" value={values.name} onChange={set("name")} aria-invalid={!!errors.name} placeholder="Ada Lovelace" autoFocus />
          </FormField>
        )}

        <FormField id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={values.email}
            onChange={set("email")}
            aria-invalid={!!errors.email}
            placeholder="you@example.com"
            autoFocus={!isRegister}
          />
        </FormField>

        <FormField id="password" label="Password" error={errors.password}>
          <PasswordInput
            id="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={values.password}
            onChange={set("password")}
            aria-invalid={!!errors.password}
            placeholder={isRegister ? "At least 10 characters, with a number" : "Your password"}
          />
          {isRegister && <PasswordStrength password={values.password} />}
        </FormField>

        {isRegister && (
          <div className="space-y-1.5">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  setErrors((errs) => ({ ...errs, acceptTerms: "" }));
                }}
                className="accent-[var(--gold)] mt-0.5 size-4 shrink-0"
                aria-invalid={!!errors.acceptTerms}
              />
              <span className="text-muted-foreground">
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="text-foreground underline underline-offset-4">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="text-foreground underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {errors.acceptTerms && <p className="text-destructive text-xs">{errors.acceptTerms}</p>}
          </div>
        )}

        <Button type="submit" variant="gold" size="xl" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {isRegister ? "Create account" : "Sign in"}
          {!pending && <ArrowRight className="size-4" />}
        </Button>
      </form>

      <p className="text-muted-foreground mt-8 text-center text-sm">
        {isRegister ? "Already have an account? " : "New to Cachet? "}
        <Link href={isRegister ? "/login" : "/register"} className="text-foreground decoration-gold/50 hover:decoration-gold font-medium underline underline-offset-4">
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
