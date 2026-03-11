"use client";

interface StatusBarProps {
  djAgent: string | null;
  vjAgent: string | null;
  audienceCount: number;
}

export function StatusBar({ djAgent, vjAgent, audienceCount }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs font-mono text-white/60">
      <div className="flex gap-4">
        <span className="code-line">
          DJ: <span className="text-green-400">{djAgent ?? "idle"}</span>
        </span>
        <span className="code-line">
          VJ: <span className="text-purple-400">{vjAgent ?? "idle"}</span>
        </span>
      </div>
      <span className="code-line">{audienceCount} watching</span>
    </div>
  );
}
