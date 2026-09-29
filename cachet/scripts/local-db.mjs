// Starts a throwaway PostgreSQL server for local development without Docker.
// Usage: npm run db:local   (keep this terminal open while you develop)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(".local-pg");
const port = Number(process.env.LOCAL_PG_PORT ?? 5433);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "cachet",
  password: "cachet",
  port,
  persistent: true,
  // Force UTF-8: on Windows initdb otherwise picks WIN1252, which cannot store characters like →.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

if (!existsSync(dataDir)) {
  await pg.initialise();
}
await pg.start();
try {
  await pg.createDatabase("cachet");
} catch {
  // database already exists
}

console.log(`\nPostgreSQL ready → postgres://cachet:cachet@localhost:${port}/cachet`);
console.log("Press Ctrl+C to stop.\n");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
