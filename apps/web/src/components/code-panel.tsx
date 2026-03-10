"use client";

interface CodePanelProps {
  code: string;
  label: string;
  overlay?: boolean;
}

export function CodePanel({ code, label, overlay }: CodePanelProps) {
  return (
    <div
      className={`font-mono text-sm ${overlay ? "absolute inset-0 pointer-events-none z-10" : "h-full flex flex-col"}`}
    >
      <div className="px-3 py-1.5 text-xs text-white/40 uppercase tracking-widest">
        {label}
      </div>
      <pre
        className={`flex-1 p-3 overflow-auto whitespace-pre-wrap ${overlay ? "text-white/60 bg-transparent" : "text-green-400 bg-black/95"}`}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
