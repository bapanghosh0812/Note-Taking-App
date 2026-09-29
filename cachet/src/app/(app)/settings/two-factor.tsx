"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, KeyRound, Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, errorMessage, unwrap } from "@/lib/api-client";
import { friendlyDate } from "@/lib/format";
import { downloadText } from "@/lib/note-export";

function BackupCodes({ codes }: { codes: string[] }) {
  return (
    <div className="space-y-3">
      <div className="border-warning/35 bg-warning/8 rounded-xl border p-3 text-xs leading-relaxed">
        <strong>Save these backup codes now.</strong> Each works once if you lose your phone. They won’t be shown again.
      </div>
      <ul className="bg-muted/50 grid grid-cols-2 gap-2 rounded-xl p-4 font-mono text-sm tracking-wider">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(codes.join("\n")).then(() => toast.success("Backup codes copied"))}>
          <Copy /> Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => downloadText("cachet-backup-codes.txt", `Cachet backup codes\n\n${codes.join("\n")}\n`, "text/plain")}>
          <Download /> Download
        </Button>
      </div>
    </div>
  );
}

export function TwoFactorSection({ enabled, enabledAt, backupCodesRemaining }: { enabled: boolean; enabledAt: string | null; backupCodesRemaining: number }) {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<"setup" | "disable" | "codes" | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["account"] });
  const close = () => {
    setDialog(null);
    setSetup(null);
    setCode("");
    setPassword("");
    setCodes(null);
  };

  const start = useMutation({
    mutationFn: () => unwrap(api.account["2fa"].setup.$post()),
    onSuccess: async (res) => {
      const qr = await QRCode.toDataURL(res.otpauthUri, { margin: 1, width: 220, color: { dark: "#1a1712", light: "#fbf8f0" } });
      setSetup({ secret: res.secret, qr });
      setDialog("setup");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const enable = useMutation({
    mutationFn: () => unwrap(api.account["2fa"].enable.$post({ json: { code } })),
    onSuccess: async (res) => {
      setCodes(res.backupCodes);
      await refresh();
      toast.success("Two-factor authentication is on");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const disable = useMutation({
    mutationFn: () => unwrap(api.account["2fa"].disable.$post({ json: { password } })),
    onSuccess: async () => {
      await refresh();
      close();
      toast.success("Two-factor authentication turned off");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const regenerate = useMutation({
    mutationFn: () => unwrap(api.account["2fa"]["backup-codes"].$post({ json: { password } })),
    onSuccess: async (res) => {
      setCodes(res.backupCodes);
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${enabled ? "bg-success/12 text-success" : "bg-warning/12 text-warning"}`}>
          {enabled ? <ShieldCheck className="size-6" /> : <ShieldOff className="size-6" />}
        </span>
        <div className="flex-1">
          <p className="font-medium">{enabled ? "Two-factor authentication is on" : "Two-factor authentication is off"}</p>
          <p className="text-muted-foreground text-sm">
            {enabled
              ? `Since ${friendlyDate(enabledAt!)} · ${backupCodesRemaining} backup code${backupCodesRemaining === 1 ? "" : "s"} left`
              : "Require a 6-digit code from Google Authenticator, Microsoft Authenticator or 1Password when signing in."}
          </p>
        </div>
        {enabled ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDialog("codes")}>
              <KeyRound /> Backup codes
            </Button>
            <Button variant="ghost" className="hover:text-destructive" onClick={() => setDialog("disable")}>
              Turn off
            </Button>
          </div>
        ) : (
          <Button variant="gold" onClick={() => start.mutate()} disabled={start.isPending}>
            {start.isPending ? <Loader2 className="animate-spin" /> : <Smartphone />} Set up 2FA
          </Button>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
          {dialog === "setup" && setup && !codes && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-3xl font-normal">Set up two-factor</DialogTitle>
                <DialogDescription>1. Scan the QR code with your authenticator app. 2. Enter the 6-digit code it shows.</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URL generated locally */}
                <img src={setup.qr} alt="QR code for your authenticator app" className="border-border size-52 rounded-xl border" />
                <p className="text-muted-foreground text-center text-xs">Can’t scan? Enter this key manually:</p>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(setup.secret).then(() => toast.success("Key copied"))}
                  className="bg-muted rounded-lg px-3 py-1.5 font-mono text-xs tracking-wider break-all"
                >
                  {setup.secret.match(/.{1,4}/g)?.join(" ")}
                </button>
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  enable.mutate();
                }}
              >
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  aria-label="6-digit code"
                  className="text-center font-mono text-lg tracking-[0.4em]"
                  autoFocus
                />
                <Button type="submit" variant="gold" disabled={code.length !== 6 || enable.isPending}>
                  {enable.isPending ? <Loader2 className="animate-spin" /> : <Check />} Verify
                </Button>
              </form>
            </>
          )}

          {codes && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-3xl font-normal">Your backup codes</DialogTitle>
                <DialogDescription>Keep them somewhere safe, like a password manager.</DialogDescription>
              </DialogHeader>
              <BackupCodes codes={codes} />
              <Button variant="gold" onClick={close}>
                I’ve saved them
              </Button>
            </>
          )}

          {(dialog === "disable" || dialog === "codes") && !codes && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-3xl font-normal">{dialog === "disable" ? "Turn off two-factor?" : "New backup codes"}</DialogTitle>
                <DialogDescription>
                  {dialog === "disable" ? "Your account will be protected by your password only." : "Generating new codes invalidates all of your old ones."} Confirm with your password.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (dialog === "disable") disable.mutate();
                  else regenerate.mutate();
                }}
              >
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" aria-label="Password" autoFocus />
                <Button type="submit" variant={dialog === "disable" ? "destructive" : "gold"} className="w-full" disabled={!password || disable.isPending || regenerate.isPending}>
                  {(disable.isPending || regenerate.isPending) && <Loader2 className="animate-spin" />}
                  {dialog === "disable" ? "Turn off 2FA" : "Generate new codes"}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
