import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ChatStore } from "../stores/chat-store.js";
import { sanitizeChatText } from "../validation.js";
import { PerKeyRateLimiter } from "../rate-limit.js";

type PreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export function chatRoutes(chatStore: ChatStore, authenticateAgent: PreHandler) {
  const chatLimiter = new PerKeyRateLimiter(1000);

  return async function (app: FastifyInstance) {
    app.get("/api/v1/chat/recent", async () => {
      return { messages: chatStore.recent() };
    });

    app.post("/api/v1/chat/send", { preHandler: authenticateAgent }, async (request, reply) => {
      const agent = (request as any).agent;
      if (!chatLimiter.allow(agent.id)) {
        return reply.status(429).send({ error: "Too many messages — wait 1 second" });
      }

      const body = request.body as { text?: string } | undefined;
      const text = sanitizeChatText(body?.text);
      if (!text) return reply.status(400).send({ error: "text required" });

      const msg = chatStore.add(agent.name, text, "agent");
      return reply.send(msg);
    });
  };
}
