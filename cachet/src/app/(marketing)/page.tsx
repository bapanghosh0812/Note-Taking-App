import {
  ArrowRight,
  Ban,
  BarChart3,
  Bell,
  Clock,
  Flame,
  History,
  KeyRound,
  Languages,
  Lock,
  PenLine,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stamp,
  Tags,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { SealMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/current-user";

const FEATURES = [
  { icon: Flame, title: "One-time links", body: "The note self-destructs after the first reading — guaranteed even when two people click at the same instant." },
  { icon: KeyRound, title: "Key-protected", body: "A fresh access key for every link. Send the link and the key through different channels." },
  { icon: Clock, title: "Expiry you control", body: "Five minutes or thirty days. Extend or shorten any link later. When time is up, it’s dead for everyone." },
  { icon: Ban, title: "Instant revoke", body: "Changed your mind? Kill one link, or every link to a note, with one click." },
  { icon: BarChart3, title: "Honest analytics", body: "Live view counts, a 14-day chart and an activity log. Wrong keys and dead links never inflate the number." },
  { icon: Bell, title: "Real-time alerts", body: "Get notified when a one-time note is opened or when someone starts guessing your key." },
  { icon: PenLine, title: "A proper editor", body: "Formatting toolbar, split preview, focus mode, voice typing, templates and Markdown import/export." },
  { icon: History, title: "Version history", body: "Every edit is snapshotted. Roll back to any earlier version in two clicks." },
  { icon: Tags, title: "Organised your way", body: "Tags, colours, pins, archive, trash with 30-day restore, and instant search with Ctrl K." },
];

const AI = [
  { icon: Wand2, title: "Rewrite & polish", body: "Improve, shorten, expand, fix grammar or change the tone of any note." },
  { icon: Languages, title: "Translate", body: "Hindi, Bengali, Tamil, Telugu, Marathi and more — formatting kept intact." },
  { icon: Sparkles, title: "Write for me", body: "Describe a checklist, email or plan and get a structured first draft." },
  { icon: ShieldCheck, title: "Smart share", body: "AI judges how sensitive a note is and pre-selects the safest share settings." },
];

const STEPS = [
  { n: "01", title: "Write", body: "Draft from scratch, a template, an imported file or an AI prompt." },
  { n: "02", title: "Seal", body: "Pick one-time or time-based, public or key-protected, and an expiry." },
  { n: "03", title: "Share & watch", body: "Send the link, then watch opens arrive live — and revoke it any time." },
];

const SECURITY = [
  "256-bit random links, stored only as SHA-256 fingerprints",
  "Access keys & passwords hashed with memory-hard scrypt",
  "Atomic database claims stop one-time race conditions",
  "Brute-force lockout that holds even under parallel guesses",
  "Two-factor authentication with backup codes",
  "Strict nonce-based Content-Security-Policy & HttpOnly sessions",
];

const FAQ = [
  { q: "Can Cachet read my notes?", a: "Notes are stored on our server (encrypted in transit, not end-to-end encrypted) so you can reach them from any device. They are never sold, shared or used for advertising. For real secrets, use key-protected one-time links with a short expiry." },
  { q: "What happens if two people open a one-time link together?", a: "Exactly one of them sees the note. The database decides atomically, so the other person gets “already opened”." },
  { q: "Do link previews in WhatsApp or Slack burn my one-time link?", a: "No. Opening a one-time note requires a click on the page, which preview bots never do." },
  { q: "Is it free?", a: "Yes — create an account and start sealing notes in seconds." },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const primaryHref = user ? "/notes/new" : "/register";

  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-12 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <div>
          <p className="border-gold/30 bg-gold-soft text-gold inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <ShieldCheck className="size-3.5" /> Private by design · now with Gemini AI
          </p>
          <h1 className="font-display mt-6 text-6xl leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
            Notes,
            <br />
            <em className="text-gold-gradient">sealed.</em>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-lg text-lg leading-relaxed">
            Write privately. Share with links that expire on your schedule, unlock only with a key, or vanish after a single reading.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild variant="gold" size="xl">
              <Link href={primaryHref}>
                {user ? "Seal a new note" : "Start writing — it’s free"} <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl">
              <Link href="#how">See how it works</Link>
            </Button>
          </div>
          <div className="text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5"><Lock className="text-gold size-4" /> Hashed links & keys</span>
            <span className="inline-flex items-center gap-1.5"><Smartphone className="text-gold size-4" /> 2FA</span>
            <span className="inline-flex items-center gap-1.5"><Search className="text-gold size-4" /> Not indexed</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-10 -z-10 bg-[radial-gradient(closest-side,var(--gold-soft),transparent)]" />
          <div className="hairline glass rotate-[-2deg] rounded-3xl p-7">
            <div className="flex items-center justify-between">
              <p className="text-gold text-[10px] font-medium tracking-[0.25em] uppercase">Shared by Aria</p>
              <span className="bg-success/12 text-success ring-success/25 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset">Active</span>
            </div>
            <p className="font-display mt-3 text-3xl leading-tight">Vault codes for the Lisbon launch</p>
            <div className="mt-4 space-y-2">
              <div className="bg-muted h-2.5 w-full rounded-full" />
              <div className="bg-muted h-2.5 w-11/12 rounded-full" />
              <div className="bg-muted h-2.5 w-4/6 rounded-full" />
            </div>
            <div className="border-border mt-6 flex items-center gap-2 border-t pt-4 text-xs">
              <span className="border-border inline-flex items-center gap-1 rounded-full border px-2 py-1"><KeyRound className="size-3" /> Key-protected</span>
              <span className="border-border inline-flex items-center gap-1 rounded-full border px-2 py-1"><Flame className="size-3" /> One-time</span>
              <span className="text-muted-foreground ml-auto inline-flex items-center gap-1"><Lock className="size-3" /> 1h 59m</span>
            </div>
          </div>
          <div className="hairline glass absolute -bottom-6 -left-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm">
            <span className="bg-gold-soft text-gold grid size-8 place-items-center rounded-full"><Bell className="size-4" /></span>
            <span>
              <span className="block font-medium">Your one-time note was opened</span>
              <span className="text-muted-foreground block text-xs">just now · unlocked with key</span>
            </span>
          </div>
          <SealMark className="animate-float absolute -top-8 -right-4 size-28" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-border/60 defer-render scroll-mt-20 border-y">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Everything included</p>
          <h2 className="font-display mt-3 max-w-2xl text-5xl leading-tight tracking-tight">A complete home for things you only want to share once.</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="hairline bg-card rounded-2xl p-6">
                <span className="bg-gold-soft text-gold ring-gold/25 grid size-11 place-items-center rounded-xl ring-1"><Icon className="size-5" /></span>
                <h3 className="font-display mt-4 text-2xl tracking-tight">{title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="defer-render mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8">
        <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">How it works</p>
        <h2 className="font-display mt-3 text-5xl tracking-tight">Three steps. Thirty seconds.</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <span className="font-display text-gold-gradient text-6xl">{s.n}</span>
              <h3 className="font-display mt-2 text-3xl">{s.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI */}
      <section className="border-border/60 defer-render border-y">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="text-gold inline-flex items-center gap-2 text-xs font-medium tracking-[0.2em] uppercase"><Sparkles className="size-3.5" /> AI, only when you ask</p>
            <h2 className="font-display mt-3 text-5xl leading-tight tracking-tight">A writing partner built into every note.</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Powered by Google Gemini. Your note is sent only when you press an AI button — never in the background — and you can switch AI off entirely in Settings.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {AI.map(({ icon: Icon, title, body }) => (
              <div key={title} className="hairline bg-card rounded-2xl p-5">
                <Icon className="text-gold size-5" />
                <h3 className="mt-3 font-medium">{title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="defer-render mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Under the seal</p>
            <h2 className="font-display mt-3 text-5xl leading-tight tracking-tight">Built like a vault, not a pastebin.</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">Even if our database were stolen, it would contain no usable share links, keys or passwords — only fingerprints of them.</p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/security">Read the security overview <ArrowRight /></Link>
            </Button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {SECURITY.map((item) => (
              <li key={item} className="hairline bg-card flex gap-3 rounded-2xl p-4 text-sm leading-snug">
                <ShieldCheck className="text-gold mt-0.5 size-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-border/60 defer-render border-t">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
          <h2 className="font-display text-center text-5xl tracking-tight">Questions, answered</h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="hairline bg-card group rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {f.q}
                  <span className="text-gold transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="text-muted-foreground mt-6 text-center text-sm">
            More in the <Link href="/help" className="text-gold underline underline-offset-4">help center</Link>.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="defer-render mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <div className="hairline bg-card relative overflow-hidden rounded-3xl px-6 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(36rem_20rem_at_50%_0%,var(--gold-soft),transparent_70%)]" />
          <SealMark className="relative mx-auto size-20" />
          <h2 className="font-display relative mt-6 text-5xl tracking-tight">Seal your first note today.</h2>
          <p className="text-muted-foreground relative mx-auto mt-3 max-w-md">Free, private, and ready in seconds.</p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="gold" size="xl">
              <Link href={primaryHref}><Stamp /> {user ? "New note" : "Create your account"}</Link>
            </Button>
            {!user && (
              <Button asChild variant="outline" size="xl">
                <Link href="/login"><Send /> Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
