import "server-only";
import type { Context } from "hono";
import { hmac } from "./crypto";

/**
 * Client IP as reported by the platform proxy. On Vercel these headers are set
 * by the edge network and cannot be spoofed by the client. Rate limits that
 * matter for security (per-link lockout) do not depend on the IP at all.
 */
export function clientIp(c: Context): string {
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp.trim();
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return "unknown";
}

export function clientIpHash(c: Context): string {
  return hmac(clientIp(c));
}

export function userAgent(c: Context): string | null {
  const ua = c.req.header("user-agent");
  return ua ? ua.slice(0, 256) : null;
}

export function clientCountry(c: Context): string | null {
  const country = c.req.header("x-vercel-ip-country");
  return country && /^[A-Z]{2}$/.test(country) ? country : null;
}
