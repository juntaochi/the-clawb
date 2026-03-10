import Fastify from "fastify";
import cors from "@fastify/cors";
import { InMemoryAgentStore } from "./stores/agent-store.js";
import { agentRoutes } from "./routes/agents.js";

export function buildApp() {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  app.get("/health", async () => ({ status: "ok" }));

  const agentStore = new InMemoryAgentStore();
  app.register(agentRoutes(agentStore));

  return app;
}
