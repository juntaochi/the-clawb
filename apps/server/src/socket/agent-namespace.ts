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
      if (result.ok) {
        io.of("/audience").emit("code:update", {
          type: data.type,
          code: data.code,
          agentName: socket.data.agentName,
        });
      }
    });

    socket.on("chat:send", (data) => {
      io.of("/audience").emit("chat:message", {
        from: socket.data.agentName,
        text: data.text,
        timestamp: Date.now(),
      });
    });
  });
}
