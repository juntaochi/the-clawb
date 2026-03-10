"use client";

interface StatusBarProps {
  djAgent: string | null;
  vjAgent: string | null;
  audienceCount: number;
}

export function StatusBar({ djAgent, vjAgent, audienceCount }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-black/90 border-t border-white/10 text-xs font-mono text-white/60">
      <div className="flex gap-6">
        <span>
          DJ: <span className="text-green-400">{djAgent ?? "idle"}</span>
        </span>
        <span>
          VJ: <span className="text-purple-400">{vjAgent ?? "idle"}</span>
        </span>
      </div>
      <span>{audienceCount} watching</span>
    </div>
  );
}
