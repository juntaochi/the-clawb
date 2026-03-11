"use client";
import { useEffect, useState, useCallback } from "react";
import { getAudienceSocket } from "../lib/socket";
import { DEFAULT_DJ_CODE, DEFAULT_HYDRA_CODE } from "../lib/defaults";

interface ClubState {
  djCode: string;
  vjCode: string;
  djAgent: string | null;
  vjAgent: string | null;
  audienceCount: number;
  chatMessages: { from: string; text: string; timestamp: number; role?: "agent" | "audience" | "system" }[];
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

    // Chat history delivered on connect — replaces REST fetch for reliability
    socket.on("chat:history", (messages: ClubState["chatMessages"]) => {
      if (Array.isArray(messages) && messages.length > 0) {
        setState((prev) => ({
          ...prev,
          chatMessages: messages,
        }));
      }
    });

    socket.on("audience:count", (data) => {
      setState((prev) => ({ ...prev, audienceCount: data.count }));
    });

    // Fetch initial state via REST (belt + suspenders with socket delivery)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    fetch(`${apiUrl}/api/v1/sessions/current`)
      .then((r) => r.json())
      .then((data) => {
        setState((prev) => ({
          ...prev,
          djCode: data.djCode || DEFAULT_DJ_CODE,
          vjCode: data.vjCode || DEFAULT_HYDRA_CODE,
          djAgent: data.djAgent?.name ?? null,
          vjAgent: data.vjAgent?.name ?? null,
        }));
      })
      .catch(() => {
        // Server unreachable — fall back to defaults
        setState((prev) => ({
          ...prev,
          djCode: prev.djCode || DEFAULT_DJ_CODE,
          vjCode: prev.vjCode || DEFAULT_HYDRA_CODE,
        }));
      });

    return () => {
      socket.off("code:update");
      socket.off("chat:message");
      socket.off("chat:history");
      socket.off("audience:count");
    };
  }, []);

  const sendChat = useCallback((text: string) => {
    getAudienceSocket().emit("chat:send", { text });
  }, []);

  return { ...state, sendChat };
}
