import type { FastifyInstance } from "fastify";
import type { ChatStore } from "../stores/chat-store.js";
import { authenticateAgent } from "../auth.js";
import type { AgentStore } from "../stores/agent-store.js";

export function chatRoutes(chatStore: ChatStore, agentStore: AgentStore) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/chat/recent", async () => {
      return { messages: chatStore.recent() };
    });

    app.post("/api/v1/chat/send", { preHandler: authenticateAgent }, async (request, reply) => {
      const body = request.body as { text?: string } | undefined;
      if (!body?.text?.trim()) return reply.status(400).send({ error: "text required" });

      const hash = (request as any).apiKeyHash as string;
      const agent = agentStore.findByApiKeyHash(hash);
      const name = agent?.name ?? "anonymous";

      const msg = chatStore.add(name, body.text.trim());
      return reply.send(msg);
    });
  };
}
