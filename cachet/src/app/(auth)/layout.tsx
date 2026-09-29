import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo, SealMark } from "@/components/brand/logo";
import { getCurrentUser } from "@/server/auth/current-user";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  // Already signed in → straight to the notes.
  if (await getCurrentUser()) redirect("/notes");

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="border-border/60 relative hidden overflow-hidden border-r lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_28rem_at_30%_40%,var(--gold-soft),transparent_70%)]" />
        <Link href="/" className="relative w-fit">
          <Logo />
        </Link>

        <div className="relative mx-auto flex max-w-md flex-col items-center text-center">
          <div className="relative mb-10">
            <div className="bg-gold/20 absolute inset-0 -z-10 scale-150 rounded-full blur-3xl" />
            <SealMark className="animate-float size-40 drop-shadow-[0_30px_40px_oklch(0.5_0.12_70/45%)]" />
          </div>
          <blockquote className="font-display text-4xl leading-tight tracking-tight">
            “Some words are meant for <em className="text-gold-gradient">one pair of eyes</em>.”
          </blockquote>
          <p className="text-muted-foreground mt-5 max-w-sm text-sm leading-relaxed">
            Seal your notes with a key, set them to vanish after a single reading, or let them fade on a
            schedule you choose.
          </p>
        </div>

        <ul className="text-muted-foreground relative grid grid-cols-3 gap-4 text-xs">
          <li>
            <span className="text-foreground block font-medium">256-bit</span>unguessable links
          </li>
          <li>
            <span className="text-foreground block font-medium">scrypt</span>hashed keys at rest
          </li>
          <li>
            <span className="text-foreground block font-medium">Atomic</span>one-time access
          </li>
        </ul>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="mb-10 w-fit lg:hidden">
          <Logo />
        </Link>
        <div className="m-auto w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
