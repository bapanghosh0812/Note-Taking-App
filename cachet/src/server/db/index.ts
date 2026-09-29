import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

// Reuse one pool per server instance (and across hot reloads in development).
const globalForDb = globalThis as unknown as { __db?: Database };

function createDb(): Database {
  const client = postgres(env().DATABASE_URL, {
    max: 5,
    // Opening a TLS connection costs several round trips; keep idle ones a while.
    idle_timeout: 120,
    connect_timeout: 10,
    // Required for PgBouncer-style poolers (e.g. Neon's "-pooler" host) in transaction mode.
    prepare: false,
  });
  return drizzle(client, { schema });
}

export function getDb(): Database {
  globalForDb.__db ??= createDb();
  return globalForDb.__db;
}

export { schema };
