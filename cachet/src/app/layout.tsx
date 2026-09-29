import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const appUrl =
  process.env.APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "Cachet — Notes, sealed.", template: "%s · Cachet" },
  description:
    "Write private notes and share them with links that expire, unlock with a key, or vanish after a single view.",
  applicationName: "Cachet",
  openGraph: {
    title: "Cachet — Notes, sealed.",
    description: "Private notes with one-time, key-protected and expiring share links.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0f0e0c" },
    { media: "(prefers-color-scheme: light)", color: "#f8f5ee" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Per-request CSP nonce set by src/proxy.ts; needed for next-themes' inline script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col">
        <Providers nonce={nonce}>
          <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
