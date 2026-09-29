export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="border-border bg-muted rounded-md border px-1.5 py-0.5 font-mono text-[11px] shadow-[inset_0_-1px_0_var(--border)]">{children}</kbd>;
}
