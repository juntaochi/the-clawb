import type { FastifyInstance } from "fastify";
import type { SessionEngine } from "../session-engine/engine.js";
import type { AgentStore } from "../stores/agent-store.js";
import { authenticateAgent } from "../auth.js";
import type { SlotType } from "@the-clawb/shared";

export function slotRoutes(engine: SessionEngine, agentStore: AgentStore) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/slots/status", async () => {
      return engine.getClubState();
    });

    app.post("/api/v1/slots/book", { preHandler: authenticateAgent }, async (request, reply) => {
      const body = request.body as { type?: string } | undefined;
      if (!body?.type || !["dj", "vj"].includes(body.type)) {
        return reply.status(400).send({ error: "type must be 'dj' or 'vj'" });
      }

      const hash = (request as any).apiKeyHash as string;
      const agent = agentStore.findByApiKeyHash(hash);
      if (!agent) return reply.status(401).send({ error: "Unknown agent" });

      const result = engine.bookSlot(agent.id, agent.name, body.type as SlotType);
      engine.processQueue();
      return reply.send(result);
    });
  };
}
