"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-10", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center transition-colors"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** Rough strength estimate for instant feedback; the server enforces the real rules. */
export function passwordScore(pw: string) {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score);
}

const LABELS = ["Too weak", "Weak", "Fair", "Strong", "Excellent"];

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordScore(password);
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i < score ? (score <= 1 ? "bg-destructive" : score === 2 ? "bg-warning" : "bg-success") : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{LABELS[score]}</p>
    </div>
  );
}
