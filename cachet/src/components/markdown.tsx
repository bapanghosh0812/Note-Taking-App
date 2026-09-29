import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Safe Markdown rendering: react-markdown builds React elements (no
 * dangerouslySetInnerHTML) and raw HTML in the note is ignored, so a note
 * cannot inject scripts. `javascript:` URLs are stripped by the default
 * URL transform.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-neutral max-w-none dark:prose-invert",
        "prose-headings:font-display prose-headings:font-normal prose-headings:tracking-tight",
        "prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl",
        "prose-a:text-gold prose-a:decoration-gold/40 prose-a:underline-offset-4 hover:prose-a:decoration-gold",
        "prose-code:rounded-md prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:border prose-pre:border-border prose-pre:bg-muted/60 prose-pre:text-foreground",
        "prose-blockquote:border-l-gold/60 prose-blockquote:font-display prose-blockquote:text-xl prose-blockquote:font-normal prose-blockquote:not-italic",
        "prose-hr:border-border prose-th:text-foreground prose-li:marker:text-gold/70",
        "break-words",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
              {children}
            </a>
          ),
          // Remote images could be used as tracking pixels to learn when a note is opened.
          img: ({ alt }) => <span className="text-muted-foreground italic">[image: {alt || "hidden"}]</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
