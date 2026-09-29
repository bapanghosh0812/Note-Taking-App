"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Download,
  Info,
  Laptop,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Palette,
  PenLine,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useRef, useState } from "react";
import { toast } from "@/lib/toast";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";
import { useShell } from "@/components/app-shell/shell-context";
import { FormField } from "@/components/form-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAiStatus } from "@/hooks/use-notes";
import { usePreferences } from "@/hooks/use-preferences";
import { ApiClientError, api, errorMessage, unwrap } from "@/lib/api-client";
import { describeUserAgent, friendlyDate, relativeTime } from "@/lib/format";
import { ACCENTS, AI_LANGUAGES, AI_TONES } from "@/lib/constants";
import type { Preferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { checkPasswordChange } from "@/lib/client-checks";
import { LIMITS } from "@/lib/constants";
import { TwoFactorSection } from "./two-factor";

const TABS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "editor", label: "Editor", icon: PenLine },
  { id: "sharing", label: "Sharing", icon: Share2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "ai", label: "AI assistant", icon: Sparkles },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "data", label: "Data & privacy", icon: Download },
  { id: "about", label: "About", icon: Info },
];

function Section({ title, description, children, danger }: { title: string; description?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={cn("hairline bg-card rounded-2xl p-5 sm:p-6", danger && "ring-destructive/25 ring-1")}>
      <h2 className={cn("font-display text-2xl tracking-tight", danger && "text-destructive")}>{title}</h2>
      {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="border-border flex flex-col gap-3 border-b py-4 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-muted inline-flex flex-wrap rounded-xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-all", value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ pref, label, description }: { pref: keyof Preferences; label: string; description?: string }) {
  const { prefs, update } = usePreferences();
  return (
    <Row label={label} description={description}>
      <Switch checked={prefs[pref] as boolean} onCheckedChange={(v) => update({ [pref]: v } as Partial<Preferences>)} aria-label={label} />
    </Row>
  );
}

const ACCENT_SWATCH: Record<(typeof ACCENTS)[number], string> = {
  gold: "bg-[oklch(0.8_0.1_82)]",
  rose: "bg-[oklch(0.72_0.13_12)]",
  emerald: "bg-[oklch(0.72_0.11_162)]",
  sapphire: "bg-[oklch(0.68_0.13_255)]",
  amethyst: "bg-[oklch(0.68_0.13_300)]",
  platinum: "bg-[oklch(0.8_0.018_250)]",
};

export function SettingsView() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab")! : "account";
  const { data, isLoading } = useQuery({ queryKey: ["account"], queryFn: () => unwrap(api.account.$get()) });

  return (
    <div>
      <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Settings</p>
      <h1 className="font-display mt-2 text-5xl tracking-tight">Preferences</h1>
      <p className="text-muted-foreground mt-2 text-sm">Changes save instantly.</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => router.replace(`/settings?tab=${t.id}`, { scroll: false })}
              aria-current={tab === t.id ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                tab === t.id ? "bg-gold-soft text-foreground font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <t.icon className={cn("size-4", tab === t.id && "text-gold")} /> {t.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          {isLoading || !data ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : (
            <>
              {tab === "account" && <AccountTab profile={data.profile} />}
              {tab === "appearance" && <AppearanceTab />}
              {tab === "editor" && <EditorTab />}
              {tab === "sharing" && <SharingTab />}
              {tab === "notifications" && <NotificationsTab />}
              {tab === "ai" && <AiTab />}
              {tab === "security" && <SecurityTab profile={data.profile} />}
              {tab === "data" && <DataTab />}
              {tab === "about" && <AboutTab />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type Profile = { name: string; email: string; bio: string | null; createdAt: string; twoFactorEnabled: boolean; twoFactorEnabledAt: string | null; backupCodesRemaining: number };

function AccountTab({ profile }: { profile: Profile }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.name);
  const save = useMutation({
    mutationFn: () => unwrap(api.account.$patch({ json: { name: name.trim() } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["account"] });
      router.refresh();
      toast.success("Name updated");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Section title="Account" description={`Member since ${friendlyDate(profile.createdAt)}.`}>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate();
        }}
      >
        <FormField id="name" label="Display name" className="flex-1" hint="Shown as “Shared by …” on your shared notes.">
          <Input id="name" value={name} maxLength={LIMITS.nameMax} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <Button type="submit" variant="outline" size="lg" disabled={!name.trim() || name.trim() === profile.name || save.isPending}>
          Save name
        </Button>
      </form>
      <FormField id="email" label="Email" className="mt-4" hint="Your sign-in address. Changing it isn’t supported yet.">
        <Input id="email" value={profile.email} disabled />
      </FormField>
      <p className="text-muted-foreground mt-5 text-sm">
        Edit your bio and avatar colour on your{" "}
        <Link href="/profile" className="text-gold underline underline-offset-4">
          profile
        </Link>
        .
      </p>
    </Section>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const { prefs, update } = usePreferences();
  return (
    <Section title="Appearance" description="Make Cachet feel like yours. Applies on every device you sign in to (theme is per device).">
      <Row label="Theme" description="Ivory is light, Obsidian is dark.">
        <div className="flex flex-wrap gap-2">
          {[
            { value: "light", label: "Ivory", icon: Sun },
            { value: "dark", label: "Obsidian", icon: Moon },
            { value: "system", label: "System", icon: Monitor },
          ].map(({ value, label, icon: Icon }) => (
            <Button key={value} variant={theme === value ? "gold" : "outline"} size="sm" onClick={() => setTheme(value)}>
              <Icon /> {label}
            </Button>
          ))}
        </div>
      </Row>
      <Row label="Accent colour" description="Used for buttons, highlights and focus rings.">
        <div className="flex gap-2" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={prefs.accent === a}
              aria-label={a}
              title={a[0]!.toUpperCase() + a.slice(1)}
              onClick={() => update({ accent: a })}
              className={cn(
                "size-8 rounded-full ring-offset-2 ring-offset-[var(--card)] transition-transform hover:scale-110",
                ACCENT_SWATCH[a],
                prefs.accent === a && "ring-foreground ring-2",
              )}
            />
          ))}
        </div>
      </Row>
      <Row label="Text size" description="Scales the whole interface.">
        <Segmented
          label="Text size"
          value={prefs.fontScale}
          onChange={(v) => update({ fontScale: v })}
          options={[
            { value: "sm", label: "Compact" },
            { value: "md", label: "Default" },
            { value: "lg", label: "Large" },
          ]}
        />
      </Row>
      <Toggle pref="reduceMotion" label="Reduce motion" description="Turns off animations and transitions." />
    </Section>
  );
}

function EditorTab() {
  const { prefs, update } = usePreferences();
  return (
    <Section title="Editor" description="How writing feels.">
      <Row label="Writing font" description="Font used while typing notes.">
        <Segmented
          label="Writing font"
          value={prefs.editorFont}
          onChange={(v) => update({ editorFont: v })}
          options={[
            { value: "sans", label: "Sans" },
            { value: "serif", label: "Serif" },
            { value: "mono", label: "Mono" },
          ]}
        />
      </Row>
      <Row label="Default view" description="What the editor opens with.">
        <Segmented
          label="Default view"
          value={prefs.editorView}
          onChange={(v) => update({ editorView: v })}
          options={[
            { value: "write", label: "Write" },
            { value: "split", label: "Split" },
            { value: "preview", label: "Preview" },
          ]}
        />
      </Row>
      <Toggle pref="autosave" label="Autosave" description="Save changes automatically a moment after you stop typing." />
      <Toggle pref="spellcheck" label="Spell check" description="Underline spelling mistakes while you type." />
      <Toggle pref="showWordCount" label="Word count" description="Show words, characters and reading time under the editor." />
    </Section>
  );
}

function SharingTab() {
  const { prefs, update } = usePreferences();
  return (
    <Section title="Sharing defaults" description="Pre-selected whenever you create a share link.">
      <Row label="Access" description="Who can open new links.">
        <Segmented
          label="Default access"
          value={prefs.defaultAccessType}
          onChange={(v) => update({ defaultAccessType: v })}
          options={[
            { value: "password", label: "Key-protected" },
            { value: "public", label: "Public" },
          ]}
        />
      </Row>
      <Row label="Share type" description="How many times a link can be opened.">
        <Segmented
          label="Default share type"
          value={prefs.defaultShareType}
          onChange={(v) => update({ defaultShareType: v })}
          options={[
            { value: "time_based", label: "Time-based" },
            { value: "one_time", label: "One-time" },
          ]}
        />
      </Row>
      <Row label="Expiry" description="Default lifetime of a new link.">
        <Segmented
          label="Default expiry"
          value={prefs.defaultExpiry}
          onChange={(v) => update({ defaultExpiry: v })}
          options={[
            { value: "1h", label: "1 hour" },
            { value: "24h", label: "24 hours" },
            { value: "7d", label: "7 days" },
            { value: "30d", label: "30 days" },
          ]}
        />
      </Row>
      <Toggle pref="warnPublicSensitive" label="Warn before sharing sensitive notes publicly" description="Asks for confirmation when a note with passwords, keys or ID numbers gets a public link." />
    </Section>
  );
}

function NotificationsTab() {
  return (
    <Section title="Notifications" description="In-app alerts under the bell icon.">
      <Toggle pref="notifyOnView" label="Link opened" description="When someone opens a one-time note, and at view milestones (1, 10, 25, 50…) for reusable links." />
      <Toggle pref="notifyOnLock" label="Brute-force lockouts" description="When a link locks after too many wrong keys — a sign someone is guessing." />
      <Toggle pref="notifyOnSecurity" label="Security alerts" description="Password changes, 2FA changes and failed 2FA sign-ins." />
    </Section>
  );
}

function AiTab() {
  const { prefs, update } = usePreferences();
  const { data } = useAiStatus();
  return (
    <Section title="AI assistant" description="Powered by Google Gemini. Your note is sent only when you press an AI button, and is not stored by Cachet.">
      <Row label="Status" description={data?.available ? `Model: ${data.model}` : "No Gemini API key is configured on this server."}>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", data?.available ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>
          {data?.available ? "Available" : "Not configured"}
        </span>
      </Row>
      <Toggle pref="aiEnabled" label="Enable AI features" description="Writing tools, title & tag suggestions, smart share and the assistant chat." />
      <Toggle pref="smartShare" label="Smart share recommendations" description="Show “Let AI recommend settings” when creating links." />
      <Row label="Default translation language" description="Pre-selected in Translate to…">
        <Select value={prefs.aiLanguage} onValueChange={(v) => update({ aiLanguage: v as Preferences["aiLanguage"] })}>
          <SelectTrigger className="w-44" aria-label="Default translation language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_LANGUAGES.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label="Preferred tone" description="Used by Change tone when you don’t pick one.">
        <Select value={prefs.aiTone} onValueChange={(v) => update({ aiTone: v as Preferences["aiTone"] })}>
          <SelectTrigger className="w-44 capitalize" aria-label="Preferred tone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_TONES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
    </Section>
  );
}

const EVENT_LABELS: Record<string, string> = {
  login_success: "Signed in",
  login_failed: "Failed sign-in (wrong password)",
  login_2fa_failed: "Failed 2FA code",
  logout: "Signed out",
  password_changed: "Password changed",
  "2fa_enabled": "Two-factor turned on",
  "2fa_disabled": "Two-factor turned off",
  backup_codes_regenerated: "Backup codes regenerated",
  backup_code_used: "Backup code used",
  sessions_revoked: "Devices signed out",
  data_exported: "Data exported",
};

function SecurityTab({ profile }: { profile: Profile }) {
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => unwrap(api.account.sessions.$get()) });
  const log = useQuery({ queryKey: ["security-log"], queryFn: () => unwrap(api.account["security-log"].$get()) });

  const changePassword = useMutation({
    mutationFn: () => unwrap(api.account.password.$post({ json: pw })),
    onSuccess: () => {
      setPw({ currentPassword: "", newPassword: "" });
      void sessions.refetch();
      void log.refetch();
      toast.success("Password changed. Other devices were signed out.");
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.status === 401) setPwErrors({ currentPassword: "Current password is incorrect" });
      else toast.error(errorMessage(e));
    },
  });
  const revokeSession = useMutation({
    mutationFn: (handle: string) => unwrap(api.account.sessions[":handle"].$delete({ param: { handle } })),
    onSuccess: () => {
      void sessions.refetch();
      toast.success("Device signed out");
    },
  });
  const revokeOthers = useMutation({
    mutationFn: () => unwrap(api.account.sessions["revoke-others"].$post()),
    onSuccess: (res) => {
      void sessions.refetch();
      toast.success(res.removed ? `Signed out ${res.removed} other device${res.removed === 1 ? "" : "s"}` : "No other devices were signed in");
    },
  });

  return (
    <>
      <Section title="Two-factor authentication" description="A second step at sign-in, so a stolen password isn’t enough.">
        <TwoFactorSection enabled={profile.twoFactorEnabled} enabledAt={profile.twoFactorEnabledAt} backupCodesRemaining={profile.backupCodesRemaining} />
      </Section>

      <Section title="Change password" description="Changing your password signs out every other device.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const errs = checkPasswordChange(pw);
            if (Object.keys(errs).length) return setPwErrors(errs);
            setPwErrors({});
            changePassword.mutate();
          }}
          className="space-y-4"
          noValidate
        >
          <FormField id="currentPassword" label="Current password" error={pwErrors.currentPassword}>
            <PasswordInput id="currentPassword" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} aria-invalid={!!pwErrors.currentPassword} />
          </FormField>
          <FormField id="newPassword" label="New password" error={pwErrors.newPassword}>
            <PasswordInput id="newPassword" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} aria-invalid={!!pwErrors.newPassword} />
            <PasswordStrength password={pw.newPassword} />
          </FormField>
          <Button type="submit" variant="gold" disabled={changePassword.isPending}>
            {changePassword.isPending && <Loader2 className="animate-spin" />} Update password
          </Button>
        </form>
      </Section>

      <Section title="Signed-in devices" description="Sessions stay valid for 7 days and renew while you keep using Cachet.">
        <ul className="space-y-2">
          {sessions.data?.sessions.map((s) => (
            <li key={s.id} className="border-border flex items-center gap-3 rounded-xl border p-3">
              <Laptop className="text-muted-foreground size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words">
                  {describeUserAgent(s.userAgent)}
                  {s.current && <span className="text-success ml-2 text-xs font-normal">This device</span>}
                </p>
                <p className="text-muted-foreground text-xs">
                  Signed in {relativeTime(s.createdAt)} · active {relativeTime(s.lastSeenAt)}
                </p>
              </div>
              {!s.current && (
                <Button variant="ghost" size="sm" onClick={() => revokeSession.mutate(s.id)} disabled={revokeSession.isPending}>
                  <LogOut /> Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Button variant="outline" className="mt-4" onClick={() => revokeOthers.mutate()} disabled={revokeOthers.isPending}>
          Sign out all other devices
        </Button>
      </Section>

      <Section title="Security log" description="The last 50 security events on your account.">
        {!log.data?.events.length ? (
          <p className="text-muted-foreground text-sm">No events yet.</p>
        ) : (
          <ul className="divide-border divide-y">
            {log.data.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className={cn(e.type.includes("failed") && "text-warning")}>{EVENT_LABELS[e.type] ?? e.type}</span>
                <span className="text-muted-foreground text-right text-xs">
                  {describeUserAgent(e.userAgent)} · {relativeTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function DataTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { replace } = usePreferences();
  const { openFeedback } = useShell();
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [importing, setImporting] = useState(false);

  const deleteAccount = useMutation({
    mutationFn: () => unwrap(api.account.$delete({ json: { password: deletePassword } })),
    onSuccess: () => {
      queryClient.clear();
      toast.success("Your account and all notes were permanently deleted.");
      router.replace("/");
      router.refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const resetPrefs = useMutation({
    mutationFn: () => unwrap(api.account.preferences.reset.$post()),
    onSuccess: (res) => {
      replace(res.preferences);
      toast.success("All preferences reset to defaults");
    },
  });

  /** Imports several .md/.txt files at once, one note per file. */
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    setImporting(true);
    let ok = 0;
    for (const file of Array.from(files).slice(0, 20)) {
      try {
        if (file.size > 200_000) throw new Error("too large");
        const text = (await file.text()).replace(/\r\n/g, "\n");
        const heading = text.match(/^\s*#\s+(.+)\n+/);
        const title = (heading?.[1] ?? file.name.replace(/\.(md|markdown|txt)$/i, "")).trim().slice(0, LIMITS.titleMax) || "Imported note";
        const content = (heading ? text.slice(heading[0].length) : text).slice(0, LIMITS.contentMax) || "(empty)";
        await unwrap(api.notes.$post({ json: { title, content, tags: ["imported"] } }));
        ok++;
      } catch {
        toast.error(`Skipped ${file.name}`);
      }
    }
    setImporting(false);
    await queryClient.invalidateQueries({ queryKey: ["notes"] });
    if (ok) toast.success(`Imported ${ok} note${ok === 1 ? "" : "s"} (tagged #imported)`);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <Section title="Import notes" description="Bring in Markdown or text files — one note per file, up to 20 at a time.">
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 className="animate-spin" /> : <Upload />} Choose files
        </Button>
        <input ref={fileRef} type="file" multiple accept=".md,.markdown,.txt,text/plain,text/markdown" className="hidden" onChange={(e) => void importFiles(e.target.files)} />
      </Section>

      <Section title="Export your data" description="Every note, tag and link setting as JSON. Keys and link addresses are never included — we don’t have them.">
        <Button asChild variant="outline">
          <a href="/api/account/export" download>
            <Download /> Download export
          </a>
        </Button>
      </Section>

      <Section title="Preferences" description="Undo every customisation in one click.">
        <Button variant="outline" onClick={() => resetPrefs.mutate()} disabled={resetPrefs.isPending}>
          <RotateCcw /> Reset all preferences
        </Button>
      </Section>

      <Section title="Privacy" description="What Cachet stores and why.">
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
          <li>Your notes are stored on our database so you can access them; they are only readable by you and people you share a link with.</li>
          <li>Share links, access keys and passwords are stored only as irreversible fingerprints.</li>
          <li>IP addresses are never stored raw — only a keyed hash used for rate limiting and your activity log.</li>
          <li>One essential cookie keeps you signed in. No ads, no third-party trackers.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/privacy">Privacy policy</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/terms">Terms of service</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={openFeedback}>
            Contact us
          </Button>
        </div>
      </Section>

      <Section title="Delete account" description="Permanently removes your account, every note, every share link and all activity. This cannot be undone." danger>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 /> Delete my account
        </Button>
      </Section>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl font-normal">Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>Enter your password to confirm. All notes and links will be destroyed immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <PasswordInput value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Your password" autoComplete="current-password" aria-label="Password" />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletePassword("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!deletePassword || deleteAccount.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteAccount.mutate();
              }}
            >
              {deleteAccount.isPending && <Loader2 className="animate-spin" />} Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function AboutTab() {
  const { openShortcuts, openFeedback } = useShell();
  return (
    <Section title="About Cachet" description="Private notes with sealed, expiring share links.">
      <Row label="Version" description="Next.js 16 · Hono · PostgreSQL · Gemini">
        <span className="font-mono text-sm">1.0.0</span>
      </Row>
      <Row label="Keyboard shortcuts" description="Every shortcut in one place.">
        <Button variant="outline" size="sm" onClick={openShortcuts}>
          View shortcuts
        </Button>
      </Row>
      <Row label="Help center" description="Guides and answers to common questions.">
        <Button asChild variant="outline" size="sm">
          <Link href="/help">Open help</Link>
        </Button>
      </Row>
      <Row label="Feedback" description="Found a bug or have an idea?">
        <Button variant="outline" size="sm" onClick={openFeedback}>
          Send feedback
        </Button>
      </Row>
      <Row label="Legal">
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/terms">Terms</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/privacy">Privacy</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/security">Security</Link>
          </Button>
        </div>
      </Row>
    </Section>
  );
}
