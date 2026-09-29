"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  successMessage = "Copied to clipboard",
  className,
  variant = "outline",
  size = "sm",
  iconOnly = false,
}: {
  value: string;
  label?: string;
  successMessage?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't access the clipboard — select and copy manually.");
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={copy} className={cn(className)} aria-label={label}>
      {copied ? <Check className="text-success" /> : <Copy />}
      {!iconOnly && <span>{copied ? "Copied" : label}</span>}
    </Button>
  );
}
