import type { Metadata } from "next";
import { ShareViewer } from "./share-viewer";

export const metadata: Metadata = {
  title: "A sealed note",
  description: "Someone shared a private note with you on Cachet.",
  robots: { index: false, follow: false },
  // Generic preview only — link unfurlers never see the note's title or content.
  openGraph: { title: "A sealed note on Cachet", description: "Open the link to read it." },
};

export default async function SharePage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  return <ShareViewer token={token} />;
}
