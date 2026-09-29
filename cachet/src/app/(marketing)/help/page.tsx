import type { Metadata } from "next";
import { HelpCenter } from "./help-center";

export const metadata: Metadata = { title: "Help center", description: "Answers about notes, share links, security, AI and your account." };

export default function HelpPage() {
  return <HelpCenter />;
}
