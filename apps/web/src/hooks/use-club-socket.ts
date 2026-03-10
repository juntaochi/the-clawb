"use client";
import { useEffect, useState, useCallback } from "react";
import { getAudienceSocket } from "../lib/socket";

interface ClubState {
  djCode: string;
  vjCode: string;
  djAgent: string | null;
  vjAgent: string | null;
  audienceCount: number;
  chatMessages: { from: string; text: string; timestamp: number }[];
}

export function useClubSocket() {
  const [state, setState] = useState<ClubState>({
    djCode: "", vjCode: "",
    djAgent: null, vjAgent: null,
    audienceCount: 0, chatMessages: [],
  });

  useEffect(() => {
    const socket = getAudienceSocket();

    socket.on("code:update", (data) => {
      setState((prev) => ({
        ...prev,
        [data.type === "dj" ? "djCode" : "vjCode"]: data.code,
        [data.type === "dj" ? "djAgent" : "vjAgent"]: data.agentName,
      }));
    });

    socket.on("chat:message", (msg) => {
      setState((prev) => ({
        ...prev,
        chatMessages: [...prev.chatMessages.slice(-199), msg],
      }));
    });

    socket.on("audience:count", (data) => {
      setState((prev) => ({ ...prev, audienceCount: data.count }));
    });

    // Fetch initial state via REST
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/sessions/current`)
      .then((r) => r.json())
      .then((data) => {
        setState((prev) => ({
          ...prev,
          djCode: data.djCode,
          vjCode: data.vjCode,
          djAgent: data.djAgent?.name ?? null,
          vjAgent: data.vjAgent?.name ?? null,
        }));
      })
      .catch(console.error);

    return () => {
      socket.off("code:update");
      socket.off("chat:message");
      socket.off("audience:count");
    };
  }, []);

  const sendChat = useCallback((text: string) => {
    getAudienceSocket().emit("chat:send", { text });
  }, []);

  return { ...state, sendChat };
}
