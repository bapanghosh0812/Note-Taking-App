import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/current-user";
import { prefetchApi } from "@/server/prefetch";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const [user, state] = await Promise.all([getCurrentUser(), prefetchApi([[["dashboard"], "/api/dashboard"]])]);
  return (
    <HydrationBoundary state={state}>
      <DashboardView firstName={user?.name.split(" ")[0] ?? "there"} />
    </HydrationBoundary>
  );
}
