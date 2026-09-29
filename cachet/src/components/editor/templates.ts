import type { LucideIcon } from "lucide-react";
import { BookOpen, ClipboardList, KeyRound, Lightbulb, ListChecks, NotebookPen, UsersRound, Wifi } from "lucide-react";

export type Template = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  title: string;
  content: string;
  tags: string[];
  /** Suggested share settings — sensitive templates default to one-time + key. */
  share?: { accessType: "public" | "password"; shareType: "one_time" | "time_based"; expiry: "1h" | "24h" | "7d" | "30d" };
};

const today = () => new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

export function getTemplates(): Template[] {
  return [
    {
      id: "meeting",
      name: "Meeting notes",
      description: "Agenda, decisions and action items",
      icon: UsersRound,
      title: `Meeting — ${today()}`,
      tags: ["meeting"],
      content: `**Attendees:** \n**Goal:** \n\n## Agenda\n1. \n2. \n\n## Discussion\n- \n\n## Decisions\n- \n\n## Action items\n- [ ] Task — owner — due date\n- [ ] `,
    },
    {
      id: "credentials",
      name: "Credentials handover",
      description: "Share a login safely, once",
      icon: KeyRound,
      title: "Access details",
      tags: ["credentials"],
      share: { accessType: "password", shareType: "one_time", expiry: "1h" },
      content: `## Service\n**URL:** \n**Username:** \n**Password:** \n\n## Notes\n- Change the password after first login.\n- This link works once and then self-destructs.`,
    },
    {
      id: "wifi",
      name: "Wi-Fi & door codes",
      description: "For guests or a team offsite",
      icon: Wifi,
      title: "Wi-Fi & access codes",
      tags: ["access"],
      share: { accessType: "password", shareType: "time_based", expiry: "24h" },
      content: `| What | Details |\n| --- | --- |\n| Wi-Fi network | |\n| Wi-Fi password | |\n| Door code | |\n| Parking | |\n\n**Host contact:** `,
    },
    {
      id: "brief",
      name: "Project brief",
      description: "Goals, scope and timeline",
      icon: ClipboardList,
      title: "Project brief",
      tags: ["project"],
      content: `## Summary\nOne paragraph describing the project.\n\n## Goals\n- \n\n## Scope\n**In:** \n**Out:** \n\n## Timeline\n| Milestone | Date |\n| --- | --- |\n| Kick-off | |\n| Launch | |\n\n## Risks\n- `,
    },
    {
      id: "checklist",
      name: "Checklist",
      description: "Tick things off as you go",
      icon: ListChecks,
      title: "Checklist",
      tags: ["todo"],
      content: `- [ ] \n- [ ] \n- [ ] `,
    },
    {
      id: "journal",
      name: "Daily journal",
      description: "Gratitude, focus and reflection",
      icon: NotebookPen,
      title: `Journal — ${today()}`,
      tags: ["journal"],
      content: `## Grateful for\n- \n\n## Today’s focus\n- \n\n## Reflection\n`,
    },
    {
      id: "idea",
      name: "Idea",
      description: "Capture a thought before it’s gone",
      icon: Lightbulb,
      title: "New idea",
      tags: ["ideas"],
      content: `## The idea\n\n## Why it matters\n\n## Next step\n- [ ] `,
    },
    {
      id: "reading",
      name: "Reading notes",
      description: "Key points and quotes from a book or article",
      icon: BookOpen,
      title: "Reading notes",
      tags: ["reading"],
      content: `**Source:** \n**Author:** \n\n## Key ideas\n1. \n\n## Quotes\n> \n\n## My takeaways\n- `,
    },
  ];
}
