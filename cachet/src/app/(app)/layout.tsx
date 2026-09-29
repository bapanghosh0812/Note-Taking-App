import { HydrationBoundary } from "@tanstack/react-query";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { AppProviders } from "@/components/app-providers";
import { resolvePreferences } from "@/lib/preferences";
import { getCurrentUser } from "@/server/auth/current-user";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { avatarUrl } from "@/server/lib/image";
import { prefetchApi } from "@/server/prefetch";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "/dashboard";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  // Sidebar data (tags, unread badge) arrives with the HTML.
  const [[profile], sidebar] = await Promise.all([
    getDb().select({ avatarColor: users.avatarColor, avatarUpdatedAt: users.avatarUpdatedAt }).from(users).where(eq(users.id, user.id)).limit(1),
    prefetchApi([
      [["tags"], "/api/notes/tags"],
      [["notifications"], "/api/notifications?limit=30"],
    ]),
  ]);

  const preferences = resolvePreferences(user.preferences);
  return (
    <AppProviders>
      <HydrationBoundary state={sidebar}>
        <AppShell user={{ name: user.name, email: user.email, avatarColor: profile?.avatarColor ?? null, avatarUrl: avatarUrl(profile?.avatarUpdatedAt) }} preferences={preferences}>
          {children}
        </AppShell>
      </HydrationBoundary>
    </AppProviders>
  );
}
