import type { Server } from "socket.io";
import type { ChatStore } from "../stores/chat-store.js";
import { sanitizeChatText, sanitizeNickname } from "../validation.js";

export function setupAudienceNamespace(io: Server, chatStore: ChatStore): void {
  const audienceNsp = io.of("/audience");

  const emitCount = async () => {
    const sockets = await audienceNsp.fetchSockets();
    audienceNsp.emit("audience:count", { count: sockets.length });
  };

  audienceNsp.on("connection", async (socket) => {
    await emitCount();

    socket.on("chat:send", (data: unknown) => {
      if (typeof data !== "object" || data === null) return;

      const { text, nickname } = data as Record<string, unknown>;

      const sanitizedText = sanitizeChatText(text);
      if (sanitizedText === null) return;

      const from =
        sanitizeNickname(nickname) ?? `anon-${socket.id.slice(0, 4)}`;
      const msg = chatStore.add(from, sanitizedText);
      audienceNsp.emit("chat:message", msg);
    });

    socket.on("disconnect", async () => {
      await emitCount();
    });
  });
}
