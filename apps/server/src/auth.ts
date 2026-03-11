import { randomBytes, createHash } from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { AgentStore } from "./stores/agent-store.js";

export function generateApiKey(): string {
  return `rave_${randomBytes(24).toString("hex")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function createAuthenticateAgent(agentStore: AgentStore) {
  return async function authenticateAgent(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing or invalid authorization header" });
    }
    const apiKey = authHeader.slice(7);
    const hash = hashApiKey(apiKey);
    const agent = agentStore.findByApiKeyHash(hash);
    if (!agent) {
      return reply.status(401).send({ error: "Invalid API key" });
    }
    (request as any).agent = agent;
  };
}
