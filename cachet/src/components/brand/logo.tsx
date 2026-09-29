import { useId } from "react";
import { cn } from "@/lib/utils";

const WAX_PATH =
  "M32.00 4.50 C35.72 4.56 39.82 3.90 43.10 5.21 C46.37 6.51 48.98 9.75 51.66 12.34 C54.33 14.93 57.77 17.47 59.16 20.75 C60.55 24.03 60.03 28.26 60.00 32.00 C59.97 35.74 60.39 39.92 58.98 43.17 C57.56 46.43 54.13 48.84 51.52 51.52 C48.90 54.20 46.54 57.81 43.29 59.25 C40.04 60.70 35.72 60.31 32.00 60.20 C28.28 60.09 24.21 60.08 20.98 58.61 C17.75 57.14 15.30 53.94 12.63 51.37 C9.95 48.81 6.38 46.44 4.93 43.21 C3.48 39.98 3.85 35.72 3.90 32.00 C3.95 28.28 3.79 24.17 5.21 20.90 C6.63 17.64 9.82 15.09 12.41 12.41 C15.00 9.74 17.48 6.16 20.75 4.84 C24.01 3.52 28.28 4.44 32.00 4.50Z";

/** Gold wax seal with a "C" monogram — the Cachet mark. */
export function SealMark({ className, title = "Cachet" }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} role="img" aria-label={title}>
      <defs>
        <radialGradient id={`wax-${id}`} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#FBEBB8" />
          <stop offset="38%" stopColor="#D9B25A" />
          <stop offset="78%" stopColor="#9C7426" />
          <stop offset="100%" stopColor="#6E4F15" />
        </radialGradient>
        <linearGradient id={`rim-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFF4CF" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#B8923E" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#5C4110" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id={`mono-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B4C12" />
          <stop offset="100%" stopColor="#4A330A" />
        </linearGradient>
      </defs>
      <path d={WAX_PATH} fill={`url(#wax-${id})`} />
      <path d={WAX_PATH} fill="none" stroke="#5C4110" strokeOpacity="0.35" strokeWidth="0.8" />
      {/* pressed inner disc */}
      <circle cx="32" cy="32" r="19.5" fill="#B8923E" fillOpacity="0.28" />
      <circle cx="32" cy="32" r="19.5" fill="none" stroke={`url(#rim-${id})`} strokeWidth="1.6" />
      <circle cx="32" cy="32" r="16.2" fill="none" stroke="#6B4C12" strokeOpacity="0.45" strokeWidth="0.6" strokeDasharray="0.6 1.6" />
      {/* monogram — embossed highlight under a dark engraved stroke */}
      <path d="M39.2 25.6 A9.2 9.2 0 1 0 39.2 38.4" fill="none" stroke="#FFF1C4" strokeOpacity="0.55" strokeWidth="3.6" strokeLinecap="round" transform="translate(0.5 0.6)" />
      <path d="M39.2 25.6 A9.2 9.2 0 1 0 39.2 38.4" fill="none" stroke={`url(#mono-${id})`} strokeWidth="3.6" strokeLinecap="round" />
      <path d="M40.6 32 l1.9 -1.9 l1.9 1.9 l-1.9 1.9z" fill="#5C4110" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <SealMark className={cn("size-8", markClassName)} />
      <span className="font-display text-[1.6rem] leading-none tracking-tight">Cachet</span>
    </span>
  );
}
