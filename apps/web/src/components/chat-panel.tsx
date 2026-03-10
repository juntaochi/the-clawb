"use client";
import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-black/80">
      <div className="px-3 py-1.5 text-xs text-white/40 uppercase tracking-widest">
        Live Chat
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1 text-sm">
        {messages.map((msg, i) => (
          <div key={i}>
            <span className="text-cyan-400">{msg.from}:</span>{" "}
            <span className="text-white/80">{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-2 border-t border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="say something..."
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
        />
      </form>
    </div>
  );
}
