import Fastify from "fastify";
import cors from "@fastify/cors";
import { InMemoryAgentStore } from "./stores/agent-store.js";
import { ChatStore } from "./stores/chat-store.js";
import { SessionEngine } from "./session-engine/engine.js";
import { createEventBus } from "./event-bus.js";
import { createAuthenticateAgent } from "./auth.js";
import { agentRoutes } from "./routes/agents.js";
import { slotRoutes } from "./routes/slots.js";
import { sessionRoutes } from "./routes/sessions.js";
import { chatRoutes } from "./routes/chat.js";
import type { SessionConfig } from "@the-clawb/shared";

const DEFAULT_SESSION_CONFIG: SessionConfig = {
  durationMs: 15 * 60 * 1000,
  warningMs: 2 * 60 * 1000,
  minPushIntervalMs: 2000,
  maxBpmDelta: 15,
  codeQueueIntervalMs: 30_000,
  codeQueueMaxDepth: 5,
};

export function buildApp(sessionConfig?: SessionConfig) {
  const app = Fastify({ logger: false });
  const corsOrigin = process.env.CORS_ORIGIN || true;
  app.register(cors, { origin: corsOrigin });
  app.get("/health", async () => ({ status: "ok" }));

  const agentStore = new InMemoryAgentStore();
  const chatStore = new ChatStore();
  const bus = createEventBus();
  const engine = new SessionEngine(sessionConfig ?? DEFAULT_SESSION_CONFIG, bus);
  const authenticateAgent = createAuthenticateAgent(agentStore);

  app.register(agentRoutes(agentStore));
  app.register(slotRoutes(engine, authenticateAgent));
  app.register(sessionRoutes(engine, authenticateAgent));
  app.register(chatRoutes(chatStore, authenticateAgent));

  return { app, agentStore, chatStore, engine, bus };
}
