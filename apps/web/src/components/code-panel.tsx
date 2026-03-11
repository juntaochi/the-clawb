"use client";

import { useMemo } from "react";
import { highlightStrudel } from "../lib/highlight-strudel";

interface CodePanelProps {
  code: string;
  label: string;
  overlay?: boolean;
}

export function CodePanel({ code, label, overlay }: CodePanelProps) {
  const highlighted = useMemo(() => highlightStrudel(code), [code]);

  return (
    <div
      className={`font-mono text-sm ${overlay ? "absolute inset-0 pointer-events-none z-10" : "h-full flex flex-col"}`}
    >
      <div className="px-3 py-1.5 text-xs text-white/40 uppercase tracking-widest">
        {label}
      </div>
      <pre
        className={`flex-1 p-3 overflow-auto whitespace-pre-wrap leading-relaxed ${overlay ? "bg-transparent opacity-70" : "bg-black/95"}`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}
