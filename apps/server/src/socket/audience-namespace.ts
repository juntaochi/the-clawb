import type { Server } from "socket.io";
import type { ChatStore } from "../stores/chat-store.js";

export function setupAudienceNamespace(io: Server, chatStore: ChatStore): void {
  const audienceNsp = io.of("/audience");

  const emitCount = async () => {
    const sockets = await audienceNsp.fetchSockets();
    audienceNsp.emit("audience:count", { count: sockets.length });
  };

  audienceNsp.on("connection", async (socket) => {
    await emitCount();

    socket.on("chat:send", (data: { text: string; nickname?: string }) => {
      const from = data.nickname ?? `anon-${socket.id.slice(0, 4)}`;
      const msg = chatStore.add(from, data.text);
      audienceNsp.emit("chat:message", msg);
    });

    socket.on("disconnect", async () => {
      await emitCount();
    });
  });
}
