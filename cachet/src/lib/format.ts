import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";

export function relativeTime(iso: string | Date, now = new Date()) {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const past = date.getTime() < now.getTime();
  const distance = formatDistanceToNowStrict(date);
  return past ? `${distance} ago` : `in ${distance}`;
}

export function friendlyDate(iso: string | Date) {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (isToday(date)) return `Today, ${format(date, "h:mm a")}`;
  if (isYesterday(date)) return `Yesterday, ${format(date, "h:mm a")}`;
  return format(date, "d MMM yyyy, h:mm a");
}

export function fullDate(iso: string | Date) {
  return format(typeof iso === "string" ? new Date(iso) : iso, "EEEE, d MMMM yyyy 'at' h:mm a");
}

/** "2d 4h", "12m 05s" — compact countdown used for expiring links. */
export function countdown(ms: number) {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function describeUserAgent(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : /curl|node|undici|python|axios/i.test(ua)
              ? "Script / API client"
              : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

export const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
