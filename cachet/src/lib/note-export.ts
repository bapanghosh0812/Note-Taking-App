/** Client-side export helpers — nothing leaves the browser. */

export function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "note"
  );
}

export function toMarkdown(note: { title: string; content: string; tags?: string[] }) {
  const tags = note.tags?.length ? `\n\n${note.tags.map((t) => `#${t.replace(/\s+/g, "-")}`).join(" ")}` : "";
  return `# ${note.title}\n\n${note.content.trim()}${tags}\n`;
}

export function downloadText(filename: string, text: string, type = "text/markdown;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
