/**
 * Creates (or resets) the demo account with a few sample notes.
 *
 *   npm run db:seed
 *
 * Reads DATABASE_URL, APP_URL, DEMO_EMAIL and DEMO_PASSWORD from .env.local / .env.
 * Share links and keys are printed once, because only their hashes are stored.
 */
import { config } from "dotenv";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { notes, shareLinks, users } from "../src/server/db/schema";
import { hashSecret } from "../src/server/lib/scrypt";

config({ path: [".env.local", ".env"] });

const { DATABASE_URL, DEMO_EMAIL = "demo@cachet.app", DEMO_PASSWORD, APP_URL = "http://localhost:3000" } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");
if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 10) throw new Error("Set DEMO_PASSWORD (min 10 chars) in your env file");

const client = postgres(DATABASE_URL, { max: 1, prepare: false });
const db = drizzle(client);

const token = () => randomBytes(32).toString("base64url");
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const accessKey = () =>
  Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")).join("-");
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000);

const SAMPLES = [
  {
    title: "Welcome to Cachet",
    content: `## Notes, sealed.

Cachet lets you share a note with a link that **you** control:

- **One-time** — self-destructs after the first reading
- **Time-based** — works until the expiry you pick
- **Key-protected** — needs a generated access key
- **Revocable** — kill any link instantly

> Tip: open a share link in a private window to see what your recipient sees.`,
    link: { shareType: "time_based" as const, accessType: "public" as const, expiresAt: inHours(24 * 30), label: "Public welcome" },
  },
  {
    title: "Offsite logistics — door & Wi-Fi codes",
    content: `**Venue:** The Glasshouse, 3rd floor

| What | Code |
| --- | --- |
| Main door | 4471# |
| Wi-Fi | GlassHouse-Guest |

password: aurora-lantern-92

_This note is shared with a one-time, key-protected link._`,
    link: { shareType: "one_time" as const, accessType: "password" as const, expiresAt: inHours(24), label: "For the ops team" },
  },
  {
    title: "Q4 launch talking points",
    content: `1. Lead with the customer problem, not the feature.
2. Three proof points: speed, privacy, simplicity.
3. Close with the pilot results and the ask.

\`Draft — do not forward.\``,
    link: { shareType: "time_based" as const, accessType: "password" as const, expiresAt: inHours(24 * 7), label: "Leadership preview" },
  },
];

async function main() {
  const email = DEMO_EMAIL.trim().toLowerCase();
  const passwordHash = await hashSecret(DEMO_PASSWORD!);

  // Reset: removing the user cascades to its notes, links and sessions.
  await db.delete(users).where(eq(users.email, email));
  const [user] = await db.insert(users).values({ email, name: "Demo User", passwordHash, termsAcceptedAt: sql`now()`, bio: "Exploring Cachet — private notes with sealed links." }).returning({ id: users.id });

  console.log(`\nDemo account ready: ${email}\n`);
  for (const sample of SAMPLES) {
    const [note] = await db.insert(notes).values({ ownerId: user!.id, title: sample.title, content: sample.content }).returning({ id: notes.id });
    const t = token();
    const key = sample.link.accessType === "password" ? accessKey() : null;
    await db.insert(shareLinks).values({
      noteId: note!.id,
      tokenHash: sha256(t),
      tokenPrefix: t.slice(0, 6),
      label: sample.link.label,
      shareType: sample.link.shareType,
      accessType: sample.link.accessType,
      keyHash: key ? await hashSecret(key.replace(/-/g, "")) : null,
      expiresAt: sample.link.expiresAt,
    });
    console.log(`• ${sample.title}\n  ${APP_URL.replace(/\/$/, "")}/share/${t}${key ? `\n  key: ${key}` : ""}\n`);
  }
  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  await client.end();
  process.exit(1);
});
