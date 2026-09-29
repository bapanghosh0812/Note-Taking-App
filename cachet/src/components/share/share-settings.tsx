"use client";

import { Clock, Flame, Globe2, KeyRound, ShieldAlert, Wand2, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { FormField } from "@/components/form-field";
import { useNow } from "@/hooks/use-now";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EXPIRY_PRESETS, presetToDate, toLocalInputValue, type ExpiryPresetId } from "@/lib/expiry";
import { friendlyDate } from "@/lib/format";
import type { Finding } from "@/lib/sensitive";
import { cn } from "@/lib/utils";
import { LIMITS, type AccessType, type ShareType } from "@/lib/validation";

export type ShareDraft = {
  accessType: AccessType;
  shareType: ShareType;
  expiry: ExpiryPresetId;
  customExpiry: string; // datetime-local value
  label: string;
};

export function defaultShareDraft(prefs?: {
  defaultAccessType?: AccessType;
  defaultShareType?: ShareType;
  defaultExpiry?: "1h" | "24h" | "7d" | "30d";
}): ShareDraft {
  return {
    accessType: prefs?.defaultAccessType ?? "password",
    shareType: prefs?.defaultShareType ?? "time_based",
    expiry: prefs?.defaultExpiry ?? "24h",
    customExpiry: toLocalInputValue(new Date(Date.now() + 2 * 60 * 60_000)),
    label: "",
  };
}

/** Resolve the draft to an absolute instant (sent to the API as ISO/UTC). */
export function resolveExpiry(draft: ShareDraft): Date | null {
  if (draft.expiry === "custom") {
    const d = new Date(draft.customExpiry);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return presetToDate(draft.expiry);
}

export function toShareSettings(draft: ShareDraft) {
  const expiresAt = resolveExpiry(draft);
  return {
    accessType: draft.accessType,
    shareType: draft.shareType,
    expiresAt: expiresAt ? expiresAt.toISOString() : "",
    label: draft.label.trim() || undefined,
  };
}

function OptionCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex w-full flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition-all outline-none",
        "focus-visible:ring-ring/50 focus-visible:ring-3",
        selected
          ? "border-gold/70 bg-gold-soft shadow-[0_0_0_1px_var(--gold)_inset]"
          : "border-border hover:border-foreground/20 hover:bg-muted/40",
      )}
    >
      <span className="flex w-full items-center gap-2">
        <Icon className={cn("size-4", selected ? "text-gold" : "text-muted-foreground")} />
        <span className="text-sm font-medium">{title}</span>
        <span
          className={cn(
            "ml-auto grid size-4 place-items-center rounded-full border transition-colors",
            selected ? "border-gold bg-gold" : "border-border",
          )}
        >
          {selected && <span className="bg-background size-1.5 rounded-full" />}
        </span>
      </span>
      <span className="text-muted-foreground text-xs leading-snug">{description}</span>
    </button>
  );
}

export function ShareSettings({
  value,
  onChange,
  errors = {},
  findings = [],
}: {
  value: ShareDraft;
  onChange: (next: ShareDraft) => void;
  errors?: Record<string, string>;
  findings?: Finding[];
}) {
  const now = useNow(30_000);
  const set = <K extends keyof ShareDraft>(key: K, v: ShareDraft[K]) => onChange({ ...value, [key]: v });
  const expiresAt = resolveExpiry(value);
  const oneTime = value.shareType === "one_time";

  const summary = useMemo(() => {
    const who = value.accessType === "public" ? "Anyone with the link" : "Only someone with the link and key";
    const how = oneTime ? "can open it once" : "can open it any number of times";
    const until = expiresAt ? `until ${friendlyDate(expiresAt)}` : "";
    return `${who} ${how} ${until}.`;
  }, [value.accessType, oneTime, expiresAt]);

  const highRisk = findings.some((f) => f.severity === "high");
  const recommended = value.accessType === "password" && (!highRisk || oneTime);

  return (
    <div className="space-y-6">
      {findings.length > 0 && (
        <div
          className={cn(
            "rounded-xl border p-3.5",
            highRisk ? "border-warning/40 bg-warning/8" : "border-border bg-muted/40",
          )}
        >
          <div className="flex items-start gap-2.5">
            <ShieldAlert className={cn("mt-0.5 size-4 shrink-0", highRisk ? "text-warning" : "text-muted-foreground")} />
            <div className="min-w-0 flex-1 text-xs leading-relaxed">
              <p className="text-foreground font-medium">Security advisor</p>
              <p className="text-muted-foreground mt-0.5">
                This note seems to contain: <span className="text-foreground">{findings.map((f) => f.label).join(", ")}</span>.
                {highRisk ? " We recommend a key-protected, one-time link with a short expiry." : " Consider protecting it with a key."}
              </p>
              {!recommended && (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="mt-2"
                  onClick={() =>
                    onChange({
                      ...value,
                      accessType: "password",
                      ...(highRisk ? { shareType: "one_time" as const, expiry: "1h" as const } : {}),
                    })
                  }
                >
                  <Wand2 /> Apply recommendation
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <fieldset>
        <legend className="text-foreground/85 mb-2.5 text-[13px] font-medium">Who can open it</legend>
        <div role="radiogroup" aria-label="Access type" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <OptionCard
            selected={value.accessType === "password"}
            onSelect={() => set("accessType", "password")}
            icon={KeyRound}
            title="Key-protected"
            description="We generate a one-off access key."
          />
          <OptionCard
            selected={value.accessType === "public"}
            onSelect={() => set("accessType", "public")}
            icon={Globe2}
            title="Public"
            description="Anyone with the link can open it."
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-foreground/85 mb-2.5 text-[13px] font-medium">How many times</legend>
        <div role="radiogroup" aria-label="Share type" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <OptionCard
            selected={value.shareType === "time_based"}
            onSelect={() => set("shareType", "time_based")}
            icon={Clock}
            title="Time-based"
            description="Opens freely until it expires."
          />
          <OptionCard
            selected={oneTime}
            onSelect={() => set("shareType", "one_time")}
            icon={Flame}
            title="One-time"
            description="Self-destructs after the first view."
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-foreground/85 mb-2.5 text-[13px] font-medium">
          {oneTime ? "Expires if unopened after" : "Expires after"}
        </legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Expiry">
          {[...EXPIRY_PRESETS, { id: "custom" as const, label: "Custom" }].map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={value.expiry === p.id}
              onClick={() => set("expiry", p.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                value.expiry === p.id
                  ? "border-gold bg-gold text-[oklch(0.2_0.02_70)]"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/25",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {value.expiry === "custom" && (
          <Input
            type="datetime-local"
            className="mt-3"
            value={value.customExpiry}
            min={toLocalInputValue(new Date(now + LIMITS.minExpiryMinutes * 60_000))}
            onChange={(e) => set("customExpiry", e.target.value)}
            aria-label="Custom expiry date and time"
            aria-invalid={!!errors.expiresAt}
          />
        )}
        {errors.expiresAt && <p className="text-destructive mt-2 text-xs">{errors.expiresAt}</p>}
      </fieldset>

      <FormField id="label" label="Label (optional)" hint="Only you see this — handy when you share with several people." error={errors.label}>
        <Input
          id="label"
          value={value.label}
          maxLength={LIMITS.labelMax}
          onChange={(e) => set("label", e.target.value)}
          placeholder="e.g. For Priya · HR onboarding"
        />
      </FormField>

      <p className="text-muted-foreground border-border border-t pt-4 text-xs leading-relaxed">{summary}</p>
    </div>
  );
}
