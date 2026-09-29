/**
 * Pure helpers that apply Markdown formatting to a textarea's value and
 * selection. They return the new value and where the selection should go,
 * so they are easy to test and reuse for toolbar buttons and shortcuts.
 */

export type Selection = { value: string; start: number; end: number };
export type Edit = { value: string; start: number; end: number };

/** Wraps the selection, e.g. **bold**. With nothing selected, inserts a placeholder and selects it. */
export function wrap(sel: Selection, before: string, after = before, placeholder = "text"): Edit {
  const selected = sel.value.slice(sel.start, sel.end);
  // Toggle off when the selection is already wrapped.
  if (sel.value.slice(sel.start - before.length, sel.start) === before && sel.value.slice(sel.end, sel.end + after.length) === after) {
    const value = sel.value.slice(0, sel.start - before.length) + selected + sel.value.slice(sel.end + after.length);
    return { value, start: sel.start - before.length, end: sel.end - before.length };
  }
  const inner = selected || placeholder;
  const value = sel.value.slice(0, sel.start) + before + inner + after + sel.value.slice(sel.end);
  const start = sel.start + before.length;
  return { value, start, end: start + inner.length };
}

/** Adds (or removes, if every line already has it) a prefix on each selected line. */
export function prefixLines(sel: Selection, prefix: string | ((index: number) => string)): Edit {
  const lineStart = sel.value.lastIndexOf("\n", sel.start - 1) + 1;
  const nextBreak = sel.value.indexOf("\n", sel.end);
  const lineEnd = nextBreak === -1 ? sel.value.length : nextBreak;
  const lines = sel.value.slice(lineStart, lineEnd).split("\n");
  const pre = (i: number) => (typeof prefix === "function" ? prefix(i) : prefix);
  const allPrefixed = lines.every((l, i) => l.startsWith(pre(i)));
  const next = lines.map((l, i) => (allPrefixed ? l.slice(pre(i).length) : pre(i) + l.replace(/^(#{1,6} |> |- \[ \] |- |\d+\. )/, ""))).join("\n");
  const value = sel.value.slice(0, lineStart) + next + sel.value.slice(lineEnd);
  return { value, start: lineStart, end: lineStart + next.length };
}

/** Inserts a block (table, divider, code fence) on its own lines at the cursor. */
export function insertBlock(sel: Selection, block: string, selectFrom?: number, selectLength?: number): Edit {
  const beforeText = sel.value.slice(0, sel.start);
  const lead = beforeText.length === 0 || beforeText.endsWith("\n\n") ? "" : beforeText.endsWith("\n") ? "\n" : "\n\n";
  const value = beforeText + lead + block + "\n" + sel.value.slice(sel.end);
  const base = sel.start + lead.length;
  return selectFrom === undefined ? { value, start: base + block.length, end: base + block.length } : { value, start: base + selectFrom, end: base + selectFrom + (selectLength ?? 0) };
}

export function link(sel: Selection): Edit {
  const selected = sel.value.slice(sel.start, sel.end) || "link text";
  const snippet = `[${selected}](https://)`;
  const value = sel.value.slice(0, sel.start) + snippet + sel.value.slice(sel.end);
  const urlStart = sel.start + selected.length + 3;
  return { value, start: urlStart, end: urlStart + "https://".length };
}

export const TABLE = "| Column | Column |\n| --- | --- |\n| Cell | Cell |";

export function stats(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { words, chars: text.length, minutes: Math.max(1, Math.round(words / 200)) };
}
