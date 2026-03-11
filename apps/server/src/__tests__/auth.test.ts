import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

async function registerAgent(app: any, name: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/agents/register",
    payload: { name },
  });
  return res.json().apiKey;
}

describe("auth preHandler", () => {
  it("returns 401 for fabricated Bearer token on chat/send", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/send",
      headers: { authorization: "Bearer rave_fake_token_not_registered" },
      payload: { text: "hello" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for missing Bearer token on chat/send", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/send",
      payload: { text: "hello" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 200 for valid registered key on chat/send with correct agent name", async () => {
    const { app } = buildApp();
    const apiKey = await registerAgent(app, "auth-test-agent");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/send",
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { text: "authenticated message" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().from).toBe("auth-test-agent");
  });

  it("returns 401 for fabricated Bearer token on slots/book", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/slots/book",
      headers: { authorization: "Bearer rave_fake_token" },
      payload: { type: "dj" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 for fabricated Bearer token on sessions/code", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/code",
      headers: { authorization: "Bearer rave_fake_token" },
      payload: { type: "dj", code: 'note("c4")' },
    });
    expect(res.statusCode).toBe(401);
  });
});
