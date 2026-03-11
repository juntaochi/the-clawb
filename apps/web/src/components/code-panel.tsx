"use client";

import { useMemo } from "react";
import { highlightStrudel } from "../lib/highlight-strudel";

interface CodePanelProps {
  code: string;
  label: string;
  overlay?: boolean;
}

/**
 * Wraps each line of highlighted HTML in a span with a dark backdrop,
 * so only the text has a background — gaps between lines show through.
 */
function wrapLines(html: string): string {
  return html
    .split("\n")
    .map(
      (line) =>
        `<span class="code-line">${line || " "}</span>`
    )
    .join("\n");
}

export function CodePanel({ code, label, overlay }: CodePanelProps) {
  const highlighted = useMemo(() => wrapLines(highlightStrudel(code)), [code]);

  return (
    <div
      className={`font-mono text-sm ${overlay ? "absolute inset-0 pointer-events-none z-10" : "h-full flex flex-col"}`}
    >
      <div className="px-3 py-1.5">
        <span className="code-line text-white/40 text-xs uppercase tracking-widest">
          {label}
        </span>
      </div>
      <pre
        className="flex-1 px-3 pb-3 overflow-auto whitespace-pre-wrap leading-relaxed"
        style={{ background: "transparent" }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}
