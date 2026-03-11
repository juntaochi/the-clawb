import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { setupAgentNamespace } from "./agent-namespace.js";
import { setupAudienceNamespace } from "./audience-namespace.js";
import { setupBroadcaster } from "./broadcaster.js";
import type { AgentStore } from "../stores/agent-store.js";
import type { ChatStore } from "../stores/chat-store.js";
import type { ClubEventBus } from "../event-bus.js";
import type { SessionEngine } from "../session-engine/engine.js";

export function setupSocketServer(
  httpServer: HttpServer,
  engine: SessionEngine,
  agentStore: AgentStore,
  chatStore: ChatStore,
  bus: ClubEventBus,
): Server {
  const corsOrigin = process.env.CORS_ORIGIN || "*";
  const io = new Server(httpServer, { cors: { origin: corsOrigin } });
  setupAgentNamespace(io, engine, agentStore);
  setupAudienceNamespace(io, chatStore);
  setupBroadcaster(io, bus, engine, chatStore);
  return io;
}
