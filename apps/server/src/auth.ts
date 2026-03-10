import { randomBytes, createHash } from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";

export function generateApiKey(): string {
  return `rave_${randomBytes(24).toString("hex")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export async function authenticateAgent(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing or invalid authorization header" });
  }
  const apiKey = authHeader.slice(7);
  (request as any).apiKeyHash = hashApiKey(apiKey);
}
