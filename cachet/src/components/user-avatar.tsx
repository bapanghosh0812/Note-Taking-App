import { cn } from "@/lib/utils";

const GRADIENTS: Record<string, string> = {
  gold: "from-[oklch(0.86_0.09_86)] to-[oklch(0.66_0.12_65)] text-[oklch(0.22_0.03_70)]",
  rose: "from-[oklch(0.82_0.1_12)] to-[oklch(0.58_0.16_12)] text-white",
  emerald: "from-[oklch(0.82_0.1_160)] to-[oklch(0.55_0.12_165)] text-white",
  sapphire: "from-[oklch(0.8_0.1_250)] to-[oklch(0.5_0.15_260)] text-white",
  amethyst: "from-[oklch(0.8_0.1_300)] to-[oklch(0.5_0.16_300)] text-white",
  slate: "from-[oklch(0.75_0.02_250)] to-[oklch(0.45_0.03_250)] text-white",
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

export function UserAvatar({ name, color, src, className }: { name: string; color?: string | null; src?: string | null; className?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small same-origin avatar served by our API
      <img src={src} alt="" aria-hidden className={cn("inline-block size-9 shrink-0 rounded-full object-cover ring-1 ring-black/5", className)} />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "font-display inline-grid size-9 shrink-0 place-items-center rounded-full bg-gradient-to-br text-sm ring-1 ring-black/5 select-none",
        GRADIENTS[color ?? "gold"] ?? GRADIENTS.gold,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
