import { handle } from "hono/vercel";
import { app } from "@/server/app";

// Node runtime: we need node:crypto (scrypt) and a TCP connection to Postgres.
export const runtime = "nodejs";

const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
