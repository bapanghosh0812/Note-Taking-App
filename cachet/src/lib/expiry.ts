export const EXPIRY_PRESETS = [
  { id: "5m", label: "5 min", ms: 5 * 60_000 },
  { id: "15m", label: "15 min", ms: 15 * 60_000 },
  { id: "1h", label: "1 hour", ms: 60 * 60_000 },
  { id: "24h", label: "24 hours", ms: 24 * 60 * 60_000 },
  { id: "7d", label: "7 days", ms: 7 * 24 * 60 * 60_000 },
  { id: "30d", label: "30 days", ms: 30 * 24 * 60 * 60_000 },
] as const;

export type ExpiryPresetId = (typeof EXPIRY_PRESETS)[number]["id"] | "custom";

export function presetToDate(id: Exclude<ExpiryPresetId, "custom">, from = Date.now()) {
  const preset = EXPIRY_PRESETS.find((p) => p.id === id)!;
  return new Date(from + preset.ms);
}

/** `yyyy-MM-ddTHH:mm` in the viewer's local time zone, for <input type="datetime-local">. */
export function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
