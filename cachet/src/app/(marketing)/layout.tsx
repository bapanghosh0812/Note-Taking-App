import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { getCurrentUser } from "@/server/auth/current-user";

export default async function MarketingLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader signedIn={Boolean(user)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
