"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Laptop, Loader2, LogOut, Monitor, Moon, Sparkles, Sun, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordInput, PasswordStrength } from "@/components/auth/password-input";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAiStatus } from "@/hooks/use-notes";
import { ApiClientError, api, errorMessage, unwrap } from "@/lib/api-client";
import { describeUserAgent, friendlyDate, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { changePasswordSchema, LIMITS } from "@/lib/validation";

type Preferences = {
  defaultShareType?: "one_time" | "time_based";
  defaultAccessType?: "public" | "password";
  defaultExpiry?: "1h" | "24h" | "7d" | "30d";
  aiEnabled?: boolean;
};
type Profile = { name: string; email: string; createdAt: string; preferences: Preferences };

function Section({ title, description, children, danger }: { title: string; description?: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={cn("hairline bg-card rounded-2xl p-5 sm:p-6", danger && "ring-destructive/25 ring-1")}>
      <h2 className={cn("font-display text-2xl tracking-tight", danger && "text-destructive")}>{title}</h2>
      {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="bg-muted inline-flex rounded-xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsView({ profile }: { profile: Profile }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { data: aiStatus } = useAiStatus();
  const [name, setName] = useState(profile.name);
  const [prefs, setPrefs] = useState<Preferences>(profile.preferences);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const updateProfile = useMutation({
    mutationFn: (body: { name?: string; preferences?: Preferences }) => unwrap(api.account.$patch({ json: body })),
    onSuccess: (res) => {
      setPrefs(res.user.preferences);
      queryClient.invalidateQueries({ queryKey: ["ai-status"] });
      router.refresh();
      toast.success("Saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const savePref = (patch: Preferences) => {
    setPrefs((p) => ({ ...p, ...patch }));
    updateProfile.mutate({ preferences: patch });
  };

  const changePassword = useMutation({
    mutationFn: () => unwrap(api.account.password.$post({ json: pw })),
    onSuccess: () => {
      setPw({ currentPassword: "", newPassword: "" });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Password changed. Other devices were signed out.");
    },
    onError: (e) => {
      if (e instanceof ApiClientError && e.status === 401) setPwErrors({ currentPassword: "Current password is incorrect" });
      else toast.error(errorMessage(e));
    },
  });

  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => unwrap(api.account.sessions.$get()) });
  const revokeSession = useMutation({
    mutationFn: (handle: string) => unwrap(api.account.sessions[":handle"].$delete({ param: { handle } })),
    onSuccess: () => {
      sessions.refetch();
      toast.success("Device signed out");
    },
  });
  const revokeOthers = useMutation({
    mutationFn: () => unwrap(api.account.sessions["revoke-others"].$post()),
    onSuccess: (res) => {
      sessions.refetch();
      toast.success(res.removed ? `Signed out ${res.removed} other device${res.removed === 1 ? "" : "s"}` : "No other devices were signed in");
    },
  });

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

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    const parsed = changePasswordSchema.safeParse(pw);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] ??= issue.message;
      setPwErrors(errs);
      return;
    }
    setPwErrors({});
    changePassword.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Settings</p>
      <h1 className="font-display mt-2 text-5xl tracking-tight">Your account</h1>
      <p className="text-muted-foreground mt-2 text-sm">Member since {friendlyDate(profile.createdAt)}</p>

      <Tabs defaultValue="profile" className="mt-8">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="sharing">Sharing & AI</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Section title="Profile" description="Your name appears on notes you share (“Shared by …”).">
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) updateProfile.mutate({ name: name.trim() });
              }}
            >
              <FormField id="name" label="Name" className="flex-1">
                <Input id="name" value={name} maxLength={LIMITS.nameMax} onChange={(e) => setName(e.target.value)} />
              </FormField>
              <Button type="submit" variant="outline" size="lg" disabled={!name.trim() || name.trim() === profile.name || updateProfile.isPending}>
                Save name
              </Button>
            </form>
            <FormField id="email" label="Email" className="mt-4" hint="Email changes are not supported in this version.">
              <Input id="email" value={profile.email} disabled />
            </FormField>
          </Section>

          <Section title="Appearance">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">Theme</p>
              <div className="flex gap-2">
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
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="sharing" className="space-y-6">
          <Section title="Default link settings" description="Pre-selected whenever you create a new share link.">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">Access</p>
                <Segmented
                  label="Default access"
                  value={prefs.defaultAccessType ?? "password"}
                  onChange={(v) => savePref({ defaultAccessType: v })}
                  options={[
                    { value: "password", label: "Key-protected" },
                    { value: "public", label: "Public" },
                  ]}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">Share type</p>
                <Segmented
                  label="Default share type"
                  value={prefs.defaultShareType ?? "time_based"}
                  onChange={(v) => savePref({ defaultShareType: v })}
                  options={[
                    { value: "time_based", label: "Time-based" },
                    { value: "one_time", label: "One-time" },
                  ]}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">Expiry</p>
                <Segmented
                  label="Default expiry"
                  value={prefs.defaultExpiry ?? "24h"}
                  onChange={(v) => savePref({ defaultExpiry: v })}
                  options={[
                    { value: "1h", label: "1h" },
                    { value: "24h", label: "24h" },
                    { value: "7d", label: "7d" },
                    { value: "30d", label: "30d" },
                  ]}
                />
              </div>
            </div>
          </Section>

          <Section title="AI assistant" description="Rewrite, summarize and title notes with Claude. Text is sent to Anthropic only when you press an AI button.">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="bg-gold-soft text-gold grid size-10 place-items-center rounded-xl">
                  <Sparkles className="size-4.5" />
                </span>
                <div>
                  <p className="text-sm font-medium">Enable AI assist</p>
                  <p className="text-muted-foreground text-xs">
                    {aiStatus?.available === false ? "Not configured on this server (no API key)." : "Available in the note editor."}
                  </p>
                </div>
              </div>
              <Switch
                checked={prefs.aiEnabled !== false}
                onCheckedChange={(checked) => savePref({ aiEnabled: checked })}
                aria-label="Enable AI assistant"
              />
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Section title="Change password" description="Changing your password signs out every other device.">
            <form onSubmit={submitPassword} className="space-y-4" noValidate>
              <FormField id="currentPassword" label="Current password" error={pwErrors.currentPassword}>
                <PasswordInput
                  id="currentPassword"
                  autoComplete="current-password"
                  value={pw.currentPassword}
                  onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
                  aria-invalid={!!pwErrors.currentPassword}
                />
              </FormField>
              <FormField id="newPassword" label="New password" error={pwErrors.newPassword}>
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  value={pw.newPassword}
                  onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
                  aria-invalid={!!pwErrors.newPassword}
                />
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
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Section title="Export your data" description="Download every note and link setting as JSON. Keys and link addresses are never included — we don’t have them.">
            <Button asChild variant="outline">
              <a href="/api/account/export" download>
                <Download /> Download export
              </a>
            </Button>
          </Section>

          <Section title="Delete account" description="Permanently removes your account, every note, every share link and all activity. This cannot be undone." danger>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 /> Delete my account
            </Button>
          </Section>
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
