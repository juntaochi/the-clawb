import type { Server } from "socket.io";
import { hashApiKey } from "../auth.js";
import type { SessionEngine } from "../session-engine/engine.js";
import type { AgentStore } from "../stores/agent-store.js";
import { PerKeyRateLimiter } from "../rate-limit.js";
import { isValidSlotType, isNonEmptyString, sanitizeChatText } from "../validation.js";

export function setupAgentNamespace(io: Server, engine: SessionEngine, agentStore: AgentStore): void {
  const agentNsp = io.of("/agent");
  const chatLimiter = new PerKeyRateLimiter(1000);

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
      if (data == null || typeof data !== "object") {
        socket.emit("code:ack", { ok: false, error: "invalid payload" });
        return;
      }
      if (!isValidSlotType(data.type)) {
        socket.emit("code:ack", { ok: false, error: "invalid slot type" });
        return;
      }
      if (!isNonEmptyString(data.code)) {
        socket.emit("code:ack", { ok: false, error: "code must be a non-empty string" });
        return;
      }
      const result = engine.pushCode(agentId, {
        type: data.type,
        code: data.code,
        immediate: data.immediate === true,
      });
      socket.emit("code:ack", result);
      // broadcast handled by bus → broadcaster
    });

    // chat:send broadcasts directly (not via bus) — chat is not a session event
    // and does not need the bus fan-out. If moderation/logging is added later,
    // route this through the bus instead.
    socket.on("chat:send", (data) => {
      if (!chatLimiter.allow(agentId)) return;
      if (data == null || typeof data !== "object") return;
      const text = sanitizeChatText(data.text);
      if (text === null) return;
      io.of("/audience").emit("chat:message", {
        from: socket.data.agentName,
        text,
        timestamp: Date.now(),
        role: "agent",
      });
    });

    socket.on("disconnect", () => {
      chatLimiter.remove(agentId);
    });
  });
}
