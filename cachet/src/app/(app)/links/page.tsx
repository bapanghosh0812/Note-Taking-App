import type { Metadata } from "next";
import { Suspense } from "react";
import { LinksView } from "./links-view";

export const metadata: Metadata = { title: "Share links" };

export default function LinksPage() {
  return (
    <Suspense>
      <LinksView />
    </Suspense>
  );
}
