import "server-only";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import { ApiError } from "./lib/errors";
import { noStore, originCheck, sessionMiddleware, type AppEnv } from "./middleware";
import { accountRoutes } from "./routes/account";
import { aiRoutes } from "./routes/ai";
import { authRoutes } from "./routes/auth";
import { notesRoutes } from "./routes/notes";
import { shareRoutes } from "./routes/share";

const base = new Hono<AppEnv>().basePath("/api");

base.use(secureHeaders({ crossOriginResourcePolicy: "same-origin" }));
base.use(noStore);
base.use(
  bodyLimit({
    maxSize: 128 * 1024, // 128 KB — comfortably above the 50k-char note limit
    onError: () => {
      throw new ApiError(413, "bad_request", "Request body is too large.");
    },
  }),
);
base.use(originCheck);
base.use(sessionMiddleware);

base.onError((err, c) => {
  if (err instanceof ApiError) {
    if (err.status === 429 || err.status === 423) {
      const retryAfter = err.details?.retryAfter;
      if (typeof retryAfter === "number") c.header("Retry-After", String(retryAfter));
    }
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }
  // Unexpected errors: log the detail server-side, return nothing that helps an attacker.
  console.error("[api] unhandled error", err);
  return c.json({ error: { code: "internal", message: "Something went wrong. Please try again." } }, 500);
});

base.notFound((c) => c.json({ error: { code: "not_found", message: "Endpoint not found" } }, 404));

// Chained so the route types flow into the typed RPC client (src/lib/api-client.ts).
export const app = base
  .get("/health", (c) => c.json({ ok: true }))
  .route("/auth", authRoutes)
  .route("/notes", notesRoutes)
  .route("/share", shareRoutes)
  .route("/account", accountRoutes)
  .route("/ai", aiRoutes);

export type AppType = typeof app;
