import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ChatStore } from "../stores/chat-store.js";

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export function chatRoutes(chatStore: ChatStore, authenticateAgent: PreHandler) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/chat/recent", async () => {
      return { messages: chatStore.recent() };
    });

    app.post("/api/v1/chat/send", { preHandler: authenticateAgent }, async (request, reply) => {
      const body = request.body as { text?: string } | undefined;
      if (!body?.text?.trim()) return reply.status(400).send({ error: "text required" });

      const agent = (request as any).agent;
      const msg = chatStore.add(agent.name, body.text.trim());
      return reply.send(msg);
    });
  };
}
