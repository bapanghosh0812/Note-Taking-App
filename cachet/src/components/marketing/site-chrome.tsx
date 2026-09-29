import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui/button";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-border/40 glass sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="Cachet home">
          <Logo markClassName="size-7" className="[&>span:last-child]:text-2xl" />
        </Link>
        <nav className="text-muted-foreground hidden items-center gap-6 text-sm md:flex" aria-label="Site">
          <Link href="/#features" className="hover:text-foreground transition-colors">Features</Link>
          <Link href="/#how" className="hover:text-foreground transition-colors">How it works</Link>
          <Link href="/security" className="hover:text-foreground transition-colors">Security</Link>
          <Link href="/help" className="hover:text-foreground transition-colors">Help</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeSwitch />
          {signedIn ? (
            <Button asChild variant="gold">
              <Link href="/dashboard">
                Open app <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="gold">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how", label: "How it works" },
      { href: "/security", label: "Security" },
      { href: "/register", label: "Create an account" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/help", label: "Help center" },
      { href: "/help#faq", label: "FAQ" },
      { href: "/help#shortcuts", label: "Keyboard shortcuts" },
      { href: "/security#disclosure", label: "Report a vulnerability" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/privacy#cookies", label: "Cookie Policy" },
      { href: "/terms#acceptable-use", label: "Acceptable Use" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-border/60 defer-render border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo markClassName="size-7" className="[&>span:last-child]:text-2xl" />
          <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
            Private notes with share links that expire, unlock with a key, or vanish after a single reading.
          </p>
          <p className="text-muted-foreground mt-4 text-xs">No ads. No trackers. One essential cookie.</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-foreground text-sm font-medium">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-border/60 border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs sm:px-8">
          <p>© {new Date().getFullYear()} Cachet. All rights reserved.</p>
          <p>Built with Next.js, Hono and PostgreSQL · AI by Google Gemini</p>
        </div>
      </div>
    </footer>
  );
}

/** Shared layout for Terms / Privacy / Security pages. */
export function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: React.ReactNode;
  sections: { id: string; title: string; body: React.ReactNode }[];
}) {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 space-y-1 text-sm" aria-label="On this page">
          <p className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-[0.18em] uppercase">On this page</p>
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-muted-foreground hover:text-foreground block rounded-md py-1 transition-colors">
              {s.title}
            </a>
          ))}
        </nav>
      </aside>
      <article className="min-w-0">
        <p className="text-gold text-xs font-medium tracking-[0.2em] uppercase">{eyebrow}</p>
        <h1 className="font-display mt-3 text-5xl tracking-tight sm:text-6xl">{title}</h1>
        <p className="text-muted-foreground mt-3 text-sm">Last updated {updated}</p>
        <div className="text-muted-foreground mt-8 max-w-3xl text-base leading-relaxed">{intro}</div>
        <div className="mt-10 max-w-3xl space-y-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="defer-render scroll-mt-24">
              <h2 className="font-display text-3xl tracking-tight">
                <span className="text-gold mr-2 text-xl tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              <div className="text-muted-foreground [&_strong]:text-foreground mt-3 space-y-3 text-[15px] leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
