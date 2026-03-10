import type { FastifyInstance } from "fastify";
import type { SessionEngine } from "../session-engine/engine.js";
import type { AgentStore } from "../stores/agent-store.js";
import { authenticateAgent } from "../auth.js";
import type { SlotType } from "@the-clawb/shared";

export function sessionRoutes(engine: SessionEngine, agentStore: AgentStore) {
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

      const hash = (request as any).apiKeyHash as string;
      const agent = agentStore.findByApiKeyHash(hash);
      if (!agent) return reply.status(401).send({ error: "Unknown agent" });

      const result = engine.pushCode(agent.id, { type: body.type as SlotType, code: body.code });
      if (!result.ok) return reply.status(403).send(result);
      return reply.send(result);
    });
  };
}
