import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { SessionEngine } from "../session-engine/engine.js";
import type { SlotType } from "@the-clawb/shared";

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export function slotRoutes(engine: SessionEngine, authenticateAgent: PreHandler) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/slots/status", async () => {
      return engine.getClubState();
    });

    app.post("/api/v1/slots/book", { preHandler: authenticateAgent }, async (request, reply) => {
      const body = request.body as { type?: string } | undefined;
      if (!body?.type || !["dj", "vj"].includes(body.type)) {
        return reply.status(400).send({ error: "type must be 'dj' or 'vj'" });
      }

      const agent = (request as any).agent;
      const result = engine.bookSlot(agent.id, agent.name, body.type as SlotType);
      engine.processQueue();
      return reply.send(result);
    });
  };
}
