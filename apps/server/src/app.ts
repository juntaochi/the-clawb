import Fastify from "fastify";
import cors from "@fastify/cors";
import { InMemoryAgentStore } from "./stores/agent-store.js";
import { ChatStore } from "./stores/chat-store.js";
import { SessionEngine } from "./session-engine/engine.js";
import { createEventBus } from "./event-bus.js";
import { agentRoutes } from "./routes/agents.js";
import { slotRoutes } from "./routes/slots.js";
import { sessionRoutes } from "./routes/sessions.js";
import { chatRoutes } from "./routes/chat.js";
import type { SessionConfig } from "@the-clawb/shared";

const DEFAULT_SESSION_CONFIG: SessionConfig = {
  durationMs: 15 * 60 * 1000,
  warningMs: 2 * 60 * 1000,
  minPushIntervalMs: 8000,
  maxBpmDelta: 15,
};

export function buildApp(sessionConfig?: SessionConfig) {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  app.get("/health", async () => ({ status: "ok" }));

  const agentStore = new InMemoryAgentStore();
  const chatStore = new ChatStore();
  const bus = createEventBus();
  const engine = new SessionEngine(sessionConfig ?? DEFAULT_SESSION_CONFIG, bus);

  app.register(agentRoutes(agentStore));
  app.register(slotRoutes(engine, agentStore));
  app.register(sessionRoutes(engine, agentStore));
  app.register(chatRoutes(chatStore, agentStore));

  return { app, agentStore, chatStore, engine };
}
