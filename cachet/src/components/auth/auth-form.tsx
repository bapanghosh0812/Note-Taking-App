"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, api, unwrap } from "@/lib/api-client";
import { safeRedirect } from "@/lib/safe-redirect";
import { loginSchema, registerSchema } from "@/lib/validation";
import { PasswordInput, PasswordStrength } from "./password-input";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isRegister = mode === "register";
  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((errs) => ({ ...errs, [key]: "" }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = isRegister ? registerSchema.safeParse(values) : loginSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
      setErrors(fieldErrors);
      return;
    }

    setPending(true);
    try {
      if (isRegister) {
        const body = registerSchema.parse(values);
        await unwrap(api.auth.register.$post({ json: body }));
        toast.success(`Welcome to Cachet, ${body.name.split(" ")[0]}`);
      } else {
        await unwrap(api.auth.login.$post({ json: loginSchema.parse(values) }));
      }
      router.replace(safeRedirect(searchParams.get("next")));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError && Object.keys(error.fields).length) setErrors(error.fields);
      setFormError(error instanceof ApiClientError ? error.message : "Something went wrong. Please try again.");
      setPending(false);
    }
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
            <Input
              id="name"
              autoComplete="name"
              value={values.name}
              onChange={set("name")}
              aria-invalid={!!errors.name}
              placeholder="Ada Lovelace"
              autoFocus
            />
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

        <Button type="submit" variant="gold" size="xl" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {isRegister ? "Create account" : "Sign in"}
          {!pending && <ArrowRight className="size-4" />}
        </Button>
      </form>

      <p className="text-muted-foreground mt-8 text-center text-sm">
        {isRegister ? "Already have an account? " : "New to Cachet? "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="text-foreground decoration-gold/50 hover:decoration-gold font-medium underline underline-offset-4"
        >
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
