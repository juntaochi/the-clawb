import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { setupAgentNamespace } from "./agent-namespace.js";
import { setupAudienceNamespace } from "./audience-namespace.js";
import type { SessionEngine } from "../session-engine/engine.js";
import type { AgentStore } from "../stores/agent-store.js";
import type { ChatStore } from "../stores/chat-store.js";

export function setupSocketServer(
  httpServer: HttpServer,
  engine: SessionEngine,
  agentStore: AgentStore,
  chatStore: ChatStore,
): Server {
  const io = new Server(httpServer, { cors: { origin: "*" } });
  setupAgentNamespace(io, engine, agentStore);
  setupAudienceNamespace(io, chatStore);
  return io;
}
