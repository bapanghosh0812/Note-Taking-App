"use client";

import { BookOpen, KeyRound, Search, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Kbd } from "@/components/kbd";
import { SHORTCUTS } from "@/lib/shortcuts";
import { Input } from "@/components/ui/input";

const TOPICS = [
  {
    id: "start",
    title: "Getting started",
    icon: BookOpen,
    faqs: [
      { q: "How do I create a note?", a: "Click “New note” (or press Alt + N). Write a title and content, choose share settings on the right, then press “Seal & create link”. Turn the share switch off to save the note privately." },
      { q: "Can I start from a template or a file?", a: "Yes. On the new-note page use “Templates” for ready-made structures (meeting notes, credentials handover, checklists…), or “Import” to load a .md or .txt file. Settings → Data & privacy imports up to 20 files at once." },
      { q: "How do I format text?", a: "Use the toolbar above the editor or Markdown: **bold**, _italic_, # headings, - lists, - [ ] checklists, > quotes, tables and code blocks. Switch to Split view to see the result while you type." },
      { q: "Is my work saved automatically?", a: "Yes, on existing notes changes are saved about a second after you stop typing. You can turn autosave off in Settings → Editor and save with Ctrl + S instead." },
      { q: "How do I find a note quickly?", a: "Press Ctrl + K anywhere to search notes, pages and actions. The notes page also has search, tag filters, sorting and grid/list views." },
    ],
  },
  {
    id: "sharing",
    title: "Sharing & links",
    icon: KeyRound,
    faqs: [
      { q: "What is the difference between one-time and time-based links?", a: "A one-time link works for exactly one successful view, then self-destructs. A time-based link can be opened any number of times until its expiry. Both have an expiry." },
      { q: "What is a key-protected link?", a: "Cachet generates a random access key like K7QM-3XHP-RW9D. The link only opens with that key. Send the link and the key through different channels for best security." },
      { q: "I lost the link or the key. Can I see it again?", a: "No — we only store an irreversible fingerprint, so nobody can recover them. Revoke the old link and create a new one, or use “Issue new key” on a key-protected link." },
      { q: "What happens after too many wrong keys?", a: "After 5 wrong attempts the link locks for 15 minutes and you get a notification. Issuing a new key clears the lock." },
      { q: "How do I stop a link from working?", a: "Open the note (or the Share links page) and press Revoke. It stops working instantly for everyone. Moving a note to trash revokes all of its links." },
      { q: "When does the view count go up?", a: "Only when someone successfully opens the note — a public view or a correct key. Wrong keys, expired or revoked links never count." },
    ],
  },
  {
    id: "security",
    title: "Security & privacy",
    icon: ShieldCheck,
    faqs: [
      { q: "How do I turn on two-factor authentication?", a: "Settings → Security → Set up 2FA. Scan the QR code with an authenticator app, enter the 6-digit code, and save your backup codes somewhere safe." },
      { q: "I lost my phone. How do I sign in?", a: "Use one of your backup codes instead of the 6-digit code. Each backup code works once." },
      { q: "Can I see where my account is signed in?", a: "Yes. Settings → Security lists signed-in devices (sign any of them out) and a security log of sign-ins, failed attempts and changes." },
      { q: "Do link previews burn a one-time note?", a: "No. Opening a one-time note needs a click on the page, which chat and email preview bots never do." },
    ],
  },
  {
    id: "ai",
    title: "AI assistant",
    icon: Sparkles,
    faqs: [
      { q: "What can the AI do?", a: "Improve, shorten, expand or fix grammar; translate; change tone; summarize; extract action items; continue writing; suggest titles and tags; draft whole notes; recommend share settings; and answer questions in the assistant chat." },
      { q: "Is my note sent to the AI automatically?", a: "Never. Text goes to Google Gemini only when you press an AI button. You can switch all AI features off in Settings → AI assistant." },
    ],
  },
  {
    id: "account",
    title: "Account",
    icon: UserRound,
    faqs: [
      { q: "How do I export my data?", a: "Settings → Data & privacy → Download export gives you every note and link setting as JSON. Individual notes can be downloaded as Markdown or printed to PDF from the note’s menu." },
      { q: "How do I delete my account?", a: "Settings → Data & privacy → Delete account. It permanently removes your notes, links and activity." },
      { q: "Can I restore a deleted note?", a: "Yes, from Trash within 30 days. After that it is deleted forever." },
    ],
  },
];

export function HelpCenter() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      TOPICS.map((t) => ({ ...t, faqs: t.faqs.filter((f) => !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)) })).filter((t) => t.faqs.length),
    [q],
  );

  return (
    <div className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
      <div className="text-center">
        <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Help center</p>
        <h1 className="font-display mt-3 text-5xl tracking-tight sm:text-6xl">How can we help?</h1>
        <div className="relative mx-auto mt-8 max-w-xl">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions — e.g. “one-time”, “2FA”, “export”" className="h-12 rounded-2xl pl-11" aria-label="Search help" />
        </div>
      </div>

      {!q && (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TOPICS.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="hairline bg-card hover:ring-gold/40 flex flex-col items-center gap-2 rounded-2xl p-4 text-center text-sm transition-all hover:ring-1">
              <t.icon className="text-gold size-5" />
              {t.title}
            </a>
          ))}
        </div>
      )}

      <div id="faq" className="mt-12 space-y-10">
        {filtered.length === 0 && <p className="text-muted-foreground text-center">No answers match “{query}”. Try another word, or send us feedback from inside the app.</p>}
        {filtered.map((topic) => (
          <section key={topic.id} id={topic.id} className="defer-render scroll-mt-24">
            <h2 className="font-display flex items-center gap-2 text-3xl tracking-tight">
              <topic.icon className="text-gold size-6" /> {topic.title}
            </h2>
            <div className="mt-4 space-y-2">
              {topic.faqs.map((f) => (
                <details key={f.q} open={Boolean(q)} className="hairline bg-card group rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {f.q}
                    <span className="text-gold shrink-0 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section id="shortcuts" className="defer-render mt-16 scroll-mt-24">
        <h2 className="font-display text-3xl tracking-tight">Keyboard shortcuts</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {SHORTCUTS.map((group) => (
            <div key={group.group} className="hairline bg-card rounded-2xl p-5">
              <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">{group.group}</p>
              <ul className="divide-border divide-y">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between py-2 text-sm">
                    {item.label}
                    <span className="flex gap-1">
                      {item.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="hairline bg-card mt-16 rounded-3xl p-8 text-center">
        <h2 className="font-display text-3xl tracking-tight">Still need help?</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">Signed-in users can reach us from the app: open the account menu and choose “Send feedback”, or ask the AI assistant.</p>
        <Link href="/login" className="text-gold mt-4 inline-block text-sm underline underline-offset-4">
          Sign in to contact us
        </Link>
      </section>
    </div>
  );
}
