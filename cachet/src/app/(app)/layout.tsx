import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-shell/app-header";
import { getCurrentUser } from "@/server/auth/current-user";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "/notes";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  return (
    <>
      <AppHeader user={{ name: user.name, email: user.email }} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </>
  );
}
