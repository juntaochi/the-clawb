import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { SessionEngine } from "../session-engine/engine.js";
import { isValidSlotType, isNonEmptyString } from "../validation.js";

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
      const body = request.body as { type?: string; code?: string; immediate?: boolean } | undefined;
      if (!body?.type || !body?.code) {
        return reply.status(400).send({ error: "type and code required" });
      }
      if (!isValidSlotType(body.type)) {
        return reply.status(400).send({ error: "type must be 'dj' or 'vj'" });
      }
      if (!isNonEmptyString(body.code)) {
        return reply.status(400).send({ error: "code must be a non-empty string" });
      }

      const agent = (request as any).agent;
      const result = engine.pushCode(agent.id, {
        type: body.type,
        code: body.code,
        immediate: body.immediate === true,
      });
      if (!result.ok) return reply.status(403).send(result);
      return reply.send(result);
    });
  };
}
