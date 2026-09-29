import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth/current-user";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = (await getCurrentUser())!; // the (app) layout already redirected guests
  return (
    <SettingsView
      profile={{ name: user.name, email: user.email, createdAt: user.createdAt.toISOString(), preferences: user.preferences }}
    />
  );
}
