import "server-only";
import { Hono } from "hono";
import { z } from "zod";
import { unlockSchema } from "@/lib/validation";
import { RULES, enforce } from "../lib/rate-limit";
import { clientCountry, clientIpHash, userAgent } from "../lib/request";
import type { AppEnv } from "../middleware";
import { accessSharedNote, getShareMeta } from "../services/share";
import { validate } from "../validation-hook";

// Length-capped so absurd paths are rejected before hashing; exact format is checked in the service.
const tokenParam = z.object({ token: z.string().min(1).max(64) });

/** Public endpoints — no session required. */
export const shareRoutes = new Hono<AppEnv>()
  // Landing info: which screen to show. Does NOT reveal content or count a view,
  // so link-preview bots (Slack, WhatsApp, email scanners) cannot burn a one-time link.
  .get("/:token", validate("param", tokenParam), async (c) => {
    await enforce(RULES.shareAccessPerIp, clientIpHash(c));
    const meta = await getShareMeta(c.req.valid("param").token);
    return c.json({ link: meta });
  })

  // The only way to read a shared note. POST so it is never prefetched or cached.
  .post(
    "/:token/access",
    validate("param", tokenParam),
    validate("json", unlockSchema),
    async (c) => {
      const ipHash = clientIpHash(c);
      const { key } = c.req.valid("json");
      await enforce(RULES.shareAccessPerIp, ipHash);
      if (key !== undefined) await enforce(RULES.shareUnlockPerIp, ipHash);

      const result = await accessSharedNote(c.req.valid("param").token, key, {
        ipHash,
        userAgent: userAgent(c),
        country: clientCountry(c),
      });
      return c.json(result);
    },
  );
