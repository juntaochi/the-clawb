import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { SessionEngine } from "../session-engine/engine.js";
import type { SlotType } from "@the-clawb/shared";

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export function sessionRoutes(engine: SessionEngine, authenticateAgent: PreHandler) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/sessions/current", async () => {
      const state = engine.getClubState();
      return {
        djCode: state.dj.code,
        vjCode: state.vj.code,
        djAgent: state.dj.agent,
        vjAgent: state.vj.agent,
        djStartedAt: state.dj.startedAt,
        vjStartedAt: state.vj.startedAt,
      };
    });

    app.post("/api/v1/sessions/code", { preHandler: authenticateAgent }, async (request, reply) => {
      const body = request.body as { type?: string; code?: string } | undefined;
      if (!body?.type || !body?.code) {
        return reply.status(400).send({ error: "type and code required" });
      }

      const agent = (request as any).agent;
      const result = engine.pushCode(agent.id, { type: body.type as SlotType, code: body.code });
      if (!result.ok) return reply.status(403).send(result);
      return reply.send(result);
    });
  };
}
