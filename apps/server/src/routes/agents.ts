import { randomUUID } from "crypto";
import type { FastifyInstance } from "fastify";
import { generateApiKey, hashApiKey } from "../auth.js";
import type { AgentStore } from "../stores/agent-store.js";

export function agentRoutes(store: AgentStore) {
  return async function (app: FastifyInstance) {
    app.post("/api/v1/agents/register", async (request, reply) => {
      const body = request.body as { name?: string } | undefined;
      if (!body || typeof body.name !== "string") {
        return reply.status(400).send({ error: "name is required (2-30 chars)" });
      }

      // Strip HTML tags and trim whitespace
      const name = body.name.replace(/<[^>]*>/g, "").trim();

      if (name.length < 2) {
        return reply.status(400).send({ error: "name is required (2-30 chars)" });
      }
      if (name.length > 30) {
        return reply.status(400).send({ error: "name must be at most 30 characters" });
      }
      if (store.findByName(name)) {
        return reply.status(409).send({ error: `Name "${name}" already taken` });
      }

      const apiKey = generateApiKey();
      const agentId = randomUUID();

      store.create({
        id: agentId,
        name,
        apiKeyHash: hashApiKey(apiKey),
        createdAt: new Date().toISOString(),
      });

      return reply.status(201).send({ apiKey, agentId });
    });
  };
}
