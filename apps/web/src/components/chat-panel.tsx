"use client";
import { useState, useRef, useEffect, useCallback } from "react";

interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
  role?: "agent" | "audience";
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

const COOLDOWN_MS = 30_000;

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const startCooldown = useCallback(() => {
    setCooldownLeft(COOLDOWN_MS);
    if (timerRef.current) clearInterval(timerRef.current);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const remaining = COOLDOWN_MS - (Date.now() - start);
      if (remaining <= 0) {
        setCooldownLeft(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
      } else {
        setCooldownLeft(remaining);
      }
    }, 250);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || cooldownLeft > 0) return;
    onSend(input.trim());
    setInput("");
    startCooldown();
  };

  const cooldownSec = Math.ceil(cooldownLeft / 1000);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1.5">
        <span className="code-line text-white/40 text-xs font-mono uppercase tracking-widest">
          Live Chat
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1 text-sm">
        {messages.map((msg, i) => (
          <div key={i} className="code-line">
            <span className={msg.role === "agent" ? "text-purple-400" : "text-cyan-400"}>{msg.from}:</span>{" "}
            <span className="text-white/80">{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-2">
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={cooldownLeft > 0 ? `wait ${cooldownSec}s...` : "say something..."}
            disabled={cooldownLeft > 0}
            className="w-full bg-black/50 backdrop-blur-sm border border-white/10 px-3 py-1.5 text-sm text-white font-mono placeholder-white/30 focus:outline-none focus:border-white/30 disabled:opacity-40"
          />
        </div>
      </form>
    </div>
  );
}
