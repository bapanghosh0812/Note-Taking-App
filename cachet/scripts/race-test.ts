/**
 * Concurrency test against a running server (local or deployed).
 *
 *   npm run test:race                          # against http://localhost:3000
 *   BASE_URL=https://your-app.vercel.app npm run test:race
 *
 * It fires many simultaneous requests at the same link and checks the
 * database-level guarantees: one winner for one-time links, exact view
 * counts for time-based links, and a hard cap on parallel key guesses.
 */
import { randomBytes } from "node:crypto";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
// Deployed servers enforce real per-IP rate limits (60 share requests/min), so use fewer requests there.
const PARALLEL = Number(process.env.PARALLEL ?? (/localhost|127.0.0.1/.test(BASE) ? 25 : 10));

let cookie = "";
const randomIp = () => `10.${rnd(256)}.${rnd(256)}.${rnd(256)}`;
const rnd = (n: number) => Math.floor(Math.random() * n);

async function api(path: string, init: RequestInit & { json?: unknown } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      origin: BASE,
      cookie,
      // Local dev trusts forwarded headers, so each simulated visitor gets its own IP bucket.
      // Behind Vercel this header is overwritten by the platform.
      "x-forwarded-for": randomIp(),
      ...(init.headers ?? {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0]!;
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "✔" : "✘"} ${name} — ${detail}`);
  if (!ok) failures++;
}
const tally = (results: { status: number }[]) =>
  results.reduce<Record<number, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});

async function createNote(share: Record<string, unknown>) {
  const res = await api("/notes", {
    method: "POST",
    json: { title: "Race test", content: "Concurrency check", share: { expiresAt: inOneHour(), ...share } },
  });
  if (res.status !== 201) throw new Error(`Could not create note: ${JSON.stringify(res.body)}`);
  const token = String(res.body.shareUrl).split("/").pop()!;
  return { noteId: res.body.note.id as string, token, key: res.body.accessKey as string | null };
}

async function main() {
  console.log(`Target: ${BASE} · ${PARALLEL} parallel requests per scenario\n`);

  const email = `race-${randomBytes(4).toString("hex")}@example.test`;
  const password = `Race-${randomBytes(9).toString("base64url")}1`;
  const reg = await api("/auth/register", { method: "POST", json: { name: "Race Tester", email, password } });
  if (reg.status !== 201) throw new Error(`Register failed: ${JSON.stringify(reg.body)}`);

  // 1. One-time public link: exactly one request may win.
  {
    const { token, noteId } = await createNote({ shareType: "one_time", accessType: "public" });
    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () => api(`/share/${token}/access`, { method: "POST", json: {} })),
    );
    const wins = results.filter((r) => r.status === 200).length;
    check("one-time public link", wins === 1, `${wins} success(es), statuses ${JSON.stringify(tally(results))}`);
    const detail = await api(`/notes/${noteId}`);
    check("one-time view count", detail.body.links[0].viewCount === 1, `view_count = ${detail.body.links[0].viewCount}`);
  }

  // 2. One-time password link, everyone has the right key.
  {
    const { token, key } = await createNote({ shareType: "one_time", accessType: "password" });
    const results = await Promise.all(
      Array.from({ length: Math.min(PARALLEL, 5) }, () => api(`/share/${token}/access`, { method: "POST", json: { key } })),
    );
    const wins = results.filter((r) => r.status === 200).length;
    check("one-time password link", wins === 1, `${wins} success(es), statuses ${JSON.stringify(tally(results))}`);
  }

  // 3. Time-based link: every concurrent view must be counted, none lost.
  {
    const { token, noteId } = await createNote({ shareType: "time_based", accessType: "public" });
    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () => api(`/share/${token}/access`, { method: "POST", json: {} })),
    );
    const ok = results.filter((r) => r.status === 200).length;
    const detail = await api(`/notes/${noteId}`);
    const count = detail.body.links[0].viewCount;
    check("time-based view count", count === ok, `${ok} successful views, view_count = ${count}`);
  }

  // 4. Parallel brute force: no more than 5 guesses may be evaluated.
  {
    const { token } = await createNote({ shareType: "time_based", accessType: "password" });
    const results = await Promise.all(
      Array.from({ length: PARALLEL }, () =>
        api(`/share/${token}/access`, { method: "POST", json: { key: "WRNG-WRNG-WRNG" } }),
      ),
    );
    const rejectedAsWrong = results.filter((r) => r.status === 401).length;
    const leaked = results.filter((r) => r.status === 200).length;
    check(
      "parallel brute force capped",
      rejectedAsWrong <= 5 && leaked === 0,
      `statuses ${JSON.stringify(tally(results))} (423 = locked; at most 5 guesses are ever checked per lock window)`,
    );
  }

  // 5. Revoked link: nobody gets in.
  {
    const { token, noteId } = await createNote({ shareType: "time_based", accessType: "public" });
    const detail = await api(`/notes/${noteId}`);
    await api(`/notes/${noteId}/links/${detail.body.links[0].id}/revoke`, { method: "POST" });
    const res = await api(`/share/${token}/access`, { method: "POST", json: {} });
    check("revoked link", res.status === 410 && res.body.error?.code === "link_revoked", `status ${res.status}`);
  }

  await api("/account", { method: "DELETE", json: { password } });
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll concurrency checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
