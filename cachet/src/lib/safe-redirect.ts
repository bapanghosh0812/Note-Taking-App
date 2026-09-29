/**
 * Only allow same-site relative paths after login. Blocks open redirects such
 * as `?next=https://evil.com` or protocol-relative `?next=//evil.com`.
 */
export function safeRedirect(target: string | null | undefined, fallback = "/notes") {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}
