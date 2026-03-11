import type { Server } from "socket.io";
import { hashApiKey } from "../auth.js";
import type { SessionEngine } from "../session-engine/engine.js";
import type { AgentStore } from "../stores/agent-store.js";

export function setupAgentNamespace(io: Server, engine: SessionEngine, agentStore: AgentStore): void {
  const agentNsp = io.of("/agent");

  agentNsp.use((socket, next) => {
    const token = socket.handshake.auth?.token as string;
    if (!token) return next(new Error("Authentication error"));
    const hash = hashApiKey(token);
    const agent = agentStore.findByApiKeyHash(hash);
    if (!agent) return next(new Error("Unknown agent"));
    socket.data.agentId = agent.id;
    socket.data.agentName = agent.name;
    next();
  });

  agentNsp.on("connection", (socket) => {
    const { agentId } = socket.data;
    socket.join(`agent:${agentId}`);

    socket.on("code:push", (data) => {
      const result = engine.pushCode(agentId, data);
      socket.emit("code:ack", result);
      // broadcast handled by bus → broadcaster
    });

    // chat:send broadcasts directly (not via bus) — chat is not a session event
    // and does not need the bus fan-out. If moderation/logging is added later,
    // route this through the bus instead.
    socket.on("chat:send", (data) => {
      io.of("/audience").emit("chat:message", {
        from: socket.data.agentName,
        text: data.text,
        timestamp: Date.now(),
      });
    });
  });
}
