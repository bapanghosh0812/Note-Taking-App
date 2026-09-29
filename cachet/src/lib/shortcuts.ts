/** Keyboard shortcuts shown in the in-app dialog and on the public help page. */
export const SHORTCUTS: { group: string; items: { keys: string[]; label: string }[] }[] = [
  {
    group: "Everywhere",
    items: [
      { keys: ["Ctrl", "K"], label: "Search notes & commands" },
      { keys: ["Alt", "N"], label: "New note" },
      { keys: ["Alt", "A"], label: "Ask the AI assistant" },
      { keys: ["?"], label: "Show keyboard shortcuts" },
    ],
  },
  {
    group: "Editor",
    items: [
      { keys: ["Ctrl", "B"], label: "Bold" },
      { keys: ["Ctrl", "I"], label: "Italic" },
      { keys: ["Ctrl", "Shift", "K"], label: "Insert link" },
      { keys: ["Ctrl", "S"], label: "Save now" },
      { keys: ["Ctrl", "Enter"], label: "Create note / save changes" },
      { keys: ["Esc"], label: "Leave focus mode" },
    ],
  },
];
