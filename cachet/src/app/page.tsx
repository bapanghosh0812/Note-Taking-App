import { ArrowRight, Ban, BarChart3, Clock, Flame, KeyRound, Lock, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { Logo, SealMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/current-user";

const FEATURES = [
  { icon: Flame, title: "One-time links", body: "The note self-destructs after the first reading — guaranteed even when two people click at the same instant." },
  { icon: KeyRound, title: "Key-protected", body: "A fresh access key is generated for every link. Send the link and the key through different channels." },
  { icon: Clock, title: "Expiry you control", body: "Fifteen minutes or thirty days. When time is up, the link is dead for everyone." },
  { icon: Ban, title: "Instant revoke", body: "Changed your mind? Kill a single link, or every link to a note, with one click." },
  { icon: BarChart3, title: "Honest view counts", body: "Only successful opens count. Wrong keys, expired or revoked links never inflate the number." },
  { icon: Sparkles, title: "AI writing assist", body: "Polish, shorten, summarize or title a note with Claude — only when you ask." },
];

const SECURITY = [
  "256-bit random links, stored only as SHA-256 fingerprints",
  "Access keys & passwords hashed with memory-hard scrypt",
  "Atomic database claims stop one-time race conditions",
  "Brute-force lockout that holds even under parallel guesses",
  "Strict nonce-based Content-Security-Policy & HttpOnly sessions",
  "Link previews can’t burn a one-time note — opening needs a click",
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Button asChild variant="gold" size="lg">
              <Link href="/notes">
                Open your vault <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="lg" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="gold" size="lg">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pt-10 pb-20 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div>
            <p className="border-gold/30 bg-gold-soft text-gold inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
              <ShieldCheck className="size-3.5" /> Private by design
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
                <Link href={user ? "/notes/new" : "/register"}>
                  {user ? "Seal a new note" : "Start writing — it’s free"} <ArrowRight />
                </Link>
              </Button>
              {!user && (
                <Button asChild variant="outline" size="xl">
                  <Link href="/login">I have an account</Link>
                </Button>
              )}
            </div>
          </div>

          {/* Product vignette */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="bg-gold/15 absolute inset-10 -z-10 rounded-full blur-3xl" />
            <div className="hairline glass rotate-[-2deg] rounded-3xl p-7">
              <div className="flex items-center justify-between">
                <p className="text-gold text-[10px] font-medium tracking-[0.25em] uppercase">Shared by Aria</p>
                <span className="bg-success/12 text-success ring-success/25 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase ring-1 ring-inset">
                  Active
                </span>
              </div>
              <p className="font-display mt-3 text-3xl leading-tight">Vault codes for the Lisbon launch</p>
              <div className="mt-4 space-y-2">
                <div className="bg-muted h-2.5 w-full rounded-full" />
                <div className="bg-muted h-2.5 w-11/12 rounded-full" />
                <div className="bg-muted h-2.5 w-4/6 rounded-full" />
              </div>
              <div className="border-border mt-6 flex items-center gap-2 border-t pt-4 text-xs">
                <span className="border-border inline-flex items-center gap-1 rounded-full border px-2 py-1">
                  <KeyRound className="size-3" /> Key-protected
                </span>
                <span className="border-border inline-flex items-center gap-1 rounded-full border px-2 py-1">
                  <Flame className="size-3" /> One-time
                </span>
                <span className="text-muted-foreground ml-auto inline-flex items-center gap-1">
                  <Lock className="size-3" /> 1h 59m
                </span>
              </div>
            </div>
            <SealMark className="animate-float absolute -top-8 -right-4 size-28 drop-shadow-[0_24px_30px_oklch(0.5_0.12_70/45%)]" />
          </div>
        </section>

        {/* Features */}
        <section className="border-border/60 border-y">
          <div className="mx-auto grid max-w-6xl gap-px px-5 py-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="p-5">
                <span className="bg-gold-soft text-gold ring-gold/25 grid size-11 place-items-center rounded-xl ring-1">
                  <Icon className="size-5" />
                </span>
                <h2 className="font-display mt-4 text-2xl tracking-tight">{title}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Security */}
        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">Under the seal</p>
              <h2 className="font-display mt-3 text-5xl leading-tight tracking-tight">Built like a vault, not a pastebin.</h2>
              <p className="text-muted-foreground mt-4 leading-relaxed">
                Even if our database were stolen, it would contain no usable share links, keys or passwords — only fingerprints of them.
              </p>
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
      </main>

      <footer className="border-border/60 border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs sm:px-8">
          <Logo markClassName="size-5" className="[&>span:last-child]:text-lg" />
          <p>Cachet — private notes with sealed, expiring links.</p>
        </div>
      </footer>
    </div>
  );
}
