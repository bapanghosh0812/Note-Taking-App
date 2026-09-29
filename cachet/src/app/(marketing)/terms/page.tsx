import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/site-chrome";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      updated="29 September 2026"
      intro={
        <p>
          These terms govern your use of Cachet (“the service”). By creating an account you agree to them. Please read them together with our{" "}
          <Link href="/privacy" className="text-gold underline underline-offset-4">Privacy Policy</Link>.
        </p>
      }
      sections={[
        {
          id: "account",
          title: "Your account",
          body: (
            <>
              <p>You must provide a valid email address and keep your password secure. You are responsible for activity on your account. We strongly recommend turning on two-factor authentication.</p>
              <p>You must be at least 13 years old (or the minimum age in your country) to use the service.</p>
            </>
          ),
        },
        {
          id: "content",
          title: "Your content",
          body: (
            <>
              <p><strong>You own your notes.</strong> We only store and process them to provide the service to you and to the people you share a link with.</p>
              <p>When you create a share link, anyone who has that link (and, for key-protected links, the key) can read the note until the link expires, is used, or is revoked. You are responsible for who you send links and keys to.</p>
            </>
          ),
        },
        {
          id: "acceptable-use",
          title: "Acceptable use",
          body: (
            <>
              <p>You agree not to use Cachet to:</p>
              <ul>
                <li>share illegal content, malware, or material that infringes someone else’s rights;</li>
                <li>harass, threaten or defraud anyone, including phishing via share links;</li>
                <li>attempt to break, overload or bypass the security of the service (including brute-forcing links or keys);</li>
                <li>scrape the service or use it to send spam.</li>
              </ul>
              <p>We may suspend accounts or disable links that break these rules.</p>
            </>
          ),
        },
        {
          id: "ai",
          title: "AI features",
          body: (
            <p>
              Optional AI features send the text you choose to Google Gemini to generate a response. AI output can be inaccurate — review it before relying on it. You can turn AI features off at any time in Settings.
            </p>
          ),
        },
        {
          id: "availability",
          title: "Availability & changes",
          body: (
            <p>
              We work hard to keep Cachet available and secure, but the service is provided “as is” without warranties. We may change or discontinue features and will update these terms when we do; continued use means you accept the updated terms.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Limitation of liability",
          body: <p>To the maximum extent permitted by law, Cachet is not liable for indirect or consequential losses, or for loss of data caused by events outside our reasonable control. Keep your own copies of important notes (Settings → Data & privacy → Export).</p>,
        },
        {
          id: "termination",
          title: "Ending your account",
          body: <p>You can delete your account at any time in Settings → Data & privacy. Deletion is immediate and permanent and removes your notes, links, activity and security log.</p>,
        },
        {
          id: "law",
          title: "Governing law",
          body: <p>These terms are governed by the laws of India. Questions about these terms can be sent through “Send feedback” in the app.</p>,
        },
      ]}
    />
  );
}
