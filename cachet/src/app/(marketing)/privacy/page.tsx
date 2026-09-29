import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/site-chrome";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      updated="29 September 2026"
      intro={<p>Cachet is built to know as little about you as possible. This page explains exactly what we store, why, and for how long.</p>}
      sections={[
        {
          id: "collect",
          title: "What we store",
          body: (
            <ul>
              <li><strong>Account:</strong> your name, email address, an optional bio and avatar colour, and your settings.</li>
              <li><strong>Password:</strong> only a salted scrypt hash — never the password itself.</li>
              <li><strong>Notes:</strong> titles, content, tags and earlier versions, so you can use them from any device. They are encrypted in transit (HTTPS) but are not end-to-end encrypted.</li>
              <li><strong>Share links:</strong> only a SHA-256 fingerprint of each link and a scrypt hash of each access key, plus its rules, expiry and view count.</li>
              <li><strong>Activity:</strong> for each successful view of your links — time, access method, browser type, and a country code where available. Sign-in and security events on your account are logged the same way.</li>
              <li><strong>IP addresses:</strong> never stored raw. We store a keyed hash (HMAC) used for rate limiting and abuse prevention.</li>
              <li><strong>Two-factor secrets:</strong> encrypted with AES-256-GCM; backup codes are stored only as hashes.</li>
            </ul>
          ),
        },
        {
          id: "use",
          title: "How we use it",
          body: (
            <p>
              Only to run the service: sign you in, store and show your notes, enforce share-link rules, show you activity and security alerts, and protect the service from abuse. We do not sell data, show ads or build advertising profiles.
            </p>
          ),
        },
        {
          id: "ai",
          title: "AI processing",
          body: (
            <p>
              When — and only when — you press an AI button, the relevant text is sent to Google Gemini to produce the answer. Cachet does not store AI prompts or answers beyond what you choose to save in a note. You can disable AI entirely in Settings.
            </p>
          ),
        },
        {
          id: "cookies",
          title: "Cookies & local storage",
          body: (
            <>
              <p>We use a single <strong>essential cookie</strong> to keep you signed in. It is HttpOnly, Secure and SameSite, so scripts and other websites can’t read or send it.</p>
              <p>Your theme choice is remembered in your browser’s local storage. We use no analytics, advertising or third-party tracking cookies, so no cookie banner is needed.</p>
            </>
          ),
        },
        {
          id: "retention",
          title: "Retention",
          body: (
            <ul>
              <li>Notes are kept until you delete them. Notes in Trash are permanently deleted after 30 days.</li>
              <li>Up to 30 earlier versions are kept per note.</li>
              <li>Expired sessions and old rate-limit records are cleaned up daily; read notifications after 90 days.</li>
              <li>Deleting your account removes all of your data immediately.</li>
            </ul>
          ),
        },
        {
          id: "rights",
          title: "Your rights",
          body: (
            <p>
              You can access and export all of your data (Settings → Data & privacy → Export), correct your profile at any time, and delete your account and everything in it. These controls are built in so you don’t have to ask us.
            </p>
          ),
        },
        {
          id: "security",
          title: "Security",
          body: <p>See our security overview for the technical measures that protect your data, and how to report a vulnerability.</p>,
        },
        {
          id: "contact",
          title: "Contact",
          body: <p>Questions about privacy can be sent through “Send feedback” in the app. We will update this page if our practices change.</p>,
        },
      ]}
    />
  );
}
