"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  FilePlus2,
  Flame,
  Globe2,
  KeyRound,
  Link2,
  NotebookText,
  PenLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Type,
  Upload,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useShell } from "@/components/app-shell/shell-context";
import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHydrated } from "@/hooks/use-hydrated";
import { useNow } from "@/hooks/use-now";
import { api, unwrap } from "@/lib/api-client";
import { countdown, describeUserAgent, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function greeting(hour: number) {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({ icon: Icon, label, value, hint, href }: { icon: LucideIcon; label: string; value: string | number; hint?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="bg-gold-soft text-gold grid size-10 place-items-center rounded-xl">
          <Icon className="size-[18px]" />
        </span>
        {href && <ArrowUpRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-muted-foreground mt-1 text-sm">{label}</p>
      {hint && <p className="mt-2 text-xs">{hint}</p>}
    </>
  );
  const cls = "group hairline bg-card block rounded-2xl p-5 transition-all";
  return href ? (
    <Link href={href} className={cn(cls, "hover:ring-gold/40 hover:-translate-y-0.5 hover:ring-1")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function ViewsChart({ data }: { data: { day: string; views: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.views));
  return (
    <div className="flex h-40 items-end gap-1.5 sm:gap-2" role="img" aria-label="Views in the last 14 days">
      {data.map((d, i) => {
        // Built from the "YYYY-MM-DD" string itself, so server and browser print the same label.
        const dayOfMonth = Number(d.day.slice(8, 10));
        const label = `${dayOfMonth} ${MONTHS[Number(d.day.slice(5, 7)) - 1]}`;
        const today = i === data.length - 1;
        return (
          <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-muted-foreground text-[10px] tabular-nums opacity-0 transition-opacity group-hover:opacity-100">{d.views}</span>
            <div
              style={{
                height: `${Math.max(4, (d.views / max) * 100)}%`,
                animationDelay: `${i * 30}ms`,
              }}
              className={cn("animate-grow w-full origin-bottom rounded-md", d.views ? (today ? "bg-accent-gradient" : "bg-gold/60") : "bg-muted")}
              title={`${label}: ${d.views} view${d.views === 1 ? "" : "s"}`}
            />
            <span className={cn("text-[10px] tabular-nums", today ? "text-foreground font-medium" : "text-muted-foreground")}>{dayOfMonth}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardView({ firstName }: { firstName: string }) {
  const now = useNow(30_000);
  const hydrated = useHydrated();
  const { openAssistant } = useShell();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => unwrap(api.dashboard.$get()),
    refetchInterval: 20_000,
  });

  const onboarding = data
    ? [
        {
          done: data.onboarding.createdNote,
          label: "Write your first note",
          href: "/notes/new",
        },
        {
          done: data.onboarding.sharedNote,
          label: "Create a share link",
          href: "/notes",
        },
        {
          done: data.onboarding.linkOpened,
          label: "Get your first view",
          href: "/links",
        },
        {
          done: data.onboarding.twoFactor,
          label: "Turn on two-factor authentication",
          href: "/settings?tab=security",
        },
        {
          done: data.onboarding.profile,
          label: "Add a bio to your profile",
          href: "/profile",
        },
      ]
    : [];
  const completed = onboarding.filter((o) => o.done).length;
  const trend = data ? data.stats.views7d - data.stats.prev7d : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {/* Time-of-day text depends on the viewer's clock, so it fills in after hydration;
              the heading itself is identical on server and client and paints straight away. */}
          <p className="text-gold min-h-4 text-xs font-medium tracking-[0.2em] uppercase">
            {hydrated && `${greeting(new Date(now).getHours())} · ${new Date(now).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`}
          </p>
          <h1 className="font-display mt-2 text-5xl tracking-tight">
            Welcome back, <em className="text-gold-gradient">{firstName}</em>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Here’s what’s happening with your notes and links.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="lg">
            <Link href="/notes/new?ai=1">
              <Sparkles className="text-gold" /> Write with AI
            </Link>
          </Button>
          <Button asChild variant="gold" size="lg">
            <Link href="/notes/new">
              <FilePlus2 /> New note
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={NotebookText}
            label="Notes"
            value={data.stats.notes}
            hint={
              <span className="text-muted-foreground">
                {data.stats.pinned} pinned · {data.stats.archived} archived
              </span>
            }
            href="/notes"
          />
          <StatCard
            icon={Link2}
            label="Active share links"
            value={data.stats.activeLinks}
            hint={<span className="text-muted-foreground">{data.stats.links} created in total</span>}
            href="/links?status=active"
          />
          <StatCard
            icon={Eye}
            label="Views in the last 7 days"
            value={data.stats.views7d}
            hint={
              <span className={trend > 0 ? "text-success" : trend < 0 ? "text-destructive" : "text-muted-foreground"}>
                {trend > 0 ? "▲" : trend < 0 ? "▼" : "•"} {Math.abs(trend)} vs previous week · {data.stats.views} all time
              </span>
            }
          />
          <StatCard
            icon={Type}
            label="Words written"
            value={data.stats.words.toLocaleString()}
            hint={<span className="text-muted-foreground">≈ {Math.max(1, Math.round(data.stats.words / 200))} min of reading</span>}
          />
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {/* Chart */}
          <section className="hairline bg-card rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl tracking-tight">Views</h2>
                <p className="text-muted-foreground text-xs">Successful opens of your share links, last 14 days</p>
              </div>
              <span className="text-2xl font-semibold tabular-nums">{data?.viewsByDay.reduce((n, d) => n + d.views, 0) ?? "–"}</span>
            </div>
            <div className="mt-6">{data ? <ViewsChart data={data.viewsByDay} /> : <Skeleton className="h-40" />}</div>
          </section>

          {/* Activity */}
          <section className="hairline bg-card rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl tracking-tight">Recent activity</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/links">
                  All links <ArrowRight />
                </Link>
              </Button>
            </div>
            {!data?.recentViews.length ? (
              <p className="text-muted-foreground py-8 text-center text-sm">No one has opened your links yet. Share a note to see activity here.</p>
            ) : (
              <ul className="mt-4 space-y-1">
                {data.recentViews.map((v) => (
                  <li key={v.id}>
                    <Link href={`/notes/${v.noteId}`} className="hover:bg-muted/50 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors">
                      <span className="bg-gold-soft text-gold grid size-9 shrink-0 place-items-center rounded-full">
                        {v.method === "password" ? <KeyRound className="size-4" /> : <Globe2 className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{v.noteTitle}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {v.method === "password" ? "Unlocked with key" : "Public view"}
                          {v.label ? ` · ${v.label}` : ""} · {describeUserAgent(v.userAgent)}
                        </span>
                      </span>
                      <time className="text-muted-foreground shrink-0 text-xs" dateTime={v.viewedAt}>
                        <LocalTime>{() => relativeTime(v.viewedAt)}</LocalTime>
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Onboarding */}
          {data && completed < onboarding.length && (
            <section className="hairline bg-card rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl tracking-tight">Get started</h2>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {completed}/{onboarding.length}
                </span>
              </div>
              <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-accent-gradient h-full rounded-full transition-all"
                  style={{
                    width: `${(completed / onboarding.length) * 100}%`,
                  }}
                />
              </div>
              <ul className="mt-4 space-y-1">
                {onboarding.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="hover:bg-muted/50 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors">
                      {item.done ? <CheckCircle2 className="text-success size-4" /> : <Circle className="text-muted-foreground size-4" />}
                      <span className={cn(item.done && "text-muted-foreground line-through")}>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Quick actions */}
          <section className="hairline bg-card rounded-2xl p-5">
            <h2 className="font-display text-2xl tracking-tight">Quick actions</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { href: "/notes/new", icon: PenLine, label: "Blank note" },
                {
                  href: "/notes/new?template=credentials",
                  icon: KeyRound,
                  label: "Credentials",
                },
                {
                  href: "/notes/new?import=1",
                  icon: Upload,
                  label: "Import file",
                },
              ].map((a) => (
                <Link key={a.label} href={a.href} className="border-border hover:border-gold/50 hover:bg-gold-soft/40 flex flex-col items-start gap-2 rounded-xl border p-3 text-sm transition-colors">
                  <a.icon className="text-gold size-4" /> {a.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => openAssistant()}
                className="border-border hover:border-gold/50 hover:bg-gold-soft/40 flex flex-col items-start gap-2 rounded-xl border p-3 text-left text-sm transition-colors"
              >
                <Sparkles className="text-gold size-4" /> Ask AI
              </button>
            </div>
          </section>

          {/* Expiring soon */}
          <section className="hairline bg-card rounded-2xl p-5">
            <h2 className="font-display text-2xl tracking-tight">Expiring soon</h2>
            {!data?.expiringSoon.length ? (
              <p className="text-muted-foreground mt-3 text-sm">No links expire in the next 48 hours.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.expiringSoon.map((l) => (
                  <li key={l.id}>
                    <Link href={`/notes/${l.noteId}`} className="hover:bg-muted/50 flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors">
                      {l.shareType === "one_time" ? <Flame className="text-warning size-4 shrink-0" /> : <Clock className="text-warning size-4 shrink-0" />}
                      <span className="min-w-0 flex-1 truncate text-sm">{l.label || l.noteTitle}</span>
                      <span className="text-warning shrink-0 text-xs tabular-nums">
                        <LocalTime>{() => countdown(new Date(l.expiresAt).getTime() - now)}</LocalTime>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Security */}
          {data && (
            <section className={cn("hairline rounded-2xl p-5", data.security.twoFactor ? "bg-card" : "bg-warning/8 ring-warning/30 ring-1")}>
              <div className="flex items-start gap-3">
                {data.security.twoFactor ? <ShieldCheck className="text-success mt-0.5 size-5" /> : <ShieldAlert className="text-warning mt-0.5 size-5" />}
                <div>
                  <h2 className="font-medium">{data.security.twoFactor ? "Your account is well protected" : "Protect your account"}</h2>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {data.security.twoFactor
                      ? `Two-factor authentication is on · ${data.security.sessions} signed-in device${data.security.sessions === 1 ? "" : "s"}.`
                      : "Turn on two-factor authentication so a stolen password isn’t enough to get in."}
                  </p>
                  <Button asChild variant={data.security.twoFactor ? "ghost" : "gold"} size="sm" className="mt-3">
                    <Link href="/settings?tab=security">{data.security.twoFactor ? "Review security" : "Enable 2FA"}</Link>
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* Recent notes */}
          <section className="hairline bg-card rounded-2xl p-5">
            <h2 className="font-display text-2xl tracking-tight">Jump back in</h2>
            {!data?.recentNotes.length ? (
              <p className="text-muted-foreground mt-3 text-sm">Your recent notes will appear here.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {data.recentNotes.map((n) => (
                  <li key={n.id}>
                    <Link href={`/notes/${n.id}`} data-note-color={n.color ?? undefined} className="hover:bg-muted/50 flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors">
                      <span className="size-2 shrink-0 rounded-full bg-[var(--note-tint,var(--gold))]" />
                      <span className="min-w-0 flex-1 truncate text-sm">{n.title}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        <LocalTime>{() => relativeTime(n.updatedAt)}</LocalTime>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
