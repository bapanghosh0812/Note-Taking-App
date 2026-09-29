"use client";

import { AlertTriangle, ExternalLink, KeyRound, Link2, QrCode } from "lucide-react";
import { motion } from "motion/react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { SealMark } from "@/components/brand/logo";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { friendlyDate } from "@/lib/format";

export type ShareResult = {
  shareUrl?: string;
  accessKey: string | null;
  link: { shareType: "one_time" | "time_based"; accessType: "public" | "password"; expiresAt: string };
  /** true when only a new key was issued for an existing link */
  keyOnly?: boolean;
};

export function ShareResultDialog({
  result,
  onClose,
  closeLabel = "Done",
}: {
  result: ShareResult | null;
  onClose: () => void;
  closeLabel?: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (!result?.shareUrl) return;
    QRCode.toDataURL(result.shareUrl, { margin: 1, width: 240, color: { dark: "#1a1712", light: "#fbf8f0" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [result?.shareUrl]);

  if (!result) return null;
  const { shareUrl, accessKey, link, keyOnly } = result;
  const oneTime = link.shareType === "one_time";
  const message = [
    shareUrl && `Here’s a private note for you: ${shareUrl}`,
    accessKey && !shareUrl && `New access key: ${accessKey}`,
    oneTime && "It can be opened only once.",
    `Link expires ${friendlyDate(link.expiresAt)}.`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="min-w-0 items-center text-center">
          <motion.div initial={{ scale: 0.4, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }}>
            <SealMark className="size-16 drop-shadow-[0_12px_24px_oklch(0.55_0.12_72/45%)]" />
          </motion.div>
          <DialogTitle className="font-display text-3xl font-normal tracking-tight">
            {keyOnly ? "New key issued" : "Sealed & ready to share"}
          </DialogTitle>
          <DialogDescription>
            {keyOnly
              ? "The previous key no longer works. Share this one instead."
              : oneTime
                ? "This link self-destructs after the first successful view."
                : `This link works until ${friendlyDate(link.expiresAt)}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          {shareUrl && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <Link2 className="size-3.5" /> Share link
              </p>
              <div className="bg-muted/60 border-border flex items-center gap-2 rounded-xl border p-1.5 pl-3">
                <code className="min-w-0 flex-1 truncate font-mono text-xs" title={shareUrl}>
                  {shareUrl}
                </code>
                <CopyButton value={shareUrl} label="Copy" successMessage="Link copied" />
              </div>
            </div>
          )}

          {accessKey && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                <KeyRound className="size-3.5" /> Access key
              </p>
              <div className="border-gold/40 bg-gold-soft flex items-center gap-2 rounded-xl border p-1.5 pl-4">
                <code className="text-gold min-w-0 flex-1 font-mono text-lg font-semibold tracking-[0.1em] whitespace-nowrap sm:text-2xl sm:tracking-[0.18em]">{accessKey}</code>
                <CopyButton value={accessKey} label="Copy" successMessage="Key copied" />
              </div>
              <p className="text-muted-foreground text-xs">
                Tip: send the key through a different channel than the link (e.g. link by email, key by SMS).
              </p>
            </div>
          )}

          <div className="border-warning/35 bg-warning/8 flex gap-2.5 rounded-xl border p-3 text-xs leading-relaxed">
            <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
            <p>
              <span className="font-medium">Shown only once.</span> We store only a fingerprint of the{" "}
              {accessKey && shareUrl ? "link and key" : accessKey ? "key" : "link"}, so nobody — not even us — can
              recover {accessKey && shareUrl ? "them" : "it"}. Copy {accessKey && shareUrl ? "them" : "it"} now.
            </p>
          </div>

          {shareUrl && qr && showQr && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL generated locally */}
              <img src={qr} alt="QR code for the share link" className="border-border size-48 rounded-xl border" />
            </motion.div>
          )}
        </div>

        <DialogFooter className="min-w-0 flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            <CopyButton value={message} label="Copy message" successMessage="Message copied" variant="ghost" />
            {shareUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowQr((s) => !s)}>
                <QrCode /> {showQr ? "Hide QR" : "QR code"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {shareUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> Open
                </a>
              </Button>
            )}
            <Button type="button" variant="gold" size="sm" onClick={onClose}>
              {closeLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
