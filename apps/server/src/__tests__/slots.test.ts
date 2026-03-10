import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildApp } from "../app.js";

async function registerAgent(app: any, name: string): Promise<string> {
  const res = await app.inject({
    method: "POST", url: "/api/v1/agents/register", payload: { name },
  });
  return res.json().apiKey;
}

describe("slot and session routes", () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it("GET /api/v1/slots/status returns idle state", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/slots/status" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dj.status).toBe("idle");
    expect(body.vj.status).toBe("idle");
  });

  it("POST /api/v1/slots/book queues and activates agent", async () => {
    const { app } = buildApp();
    const apiKey = await registerAgent(app, "dj-one");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/slots/book",
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { type: "dj" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().position).toBeDefined();

    // Check it's now active
    const status = await app.inject({ method: "GET", url: "/api/v1/slots/status" });
    expect(status.json().dj.status).toBe("active");
    expect(status.json().dj.agent.name).toBe("dj-one");
  });

  it("GET /api/v1/sessions/current returns current code", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/sessions/current" });
    expect(res.statusCode).toBe(200);
    expect(res.json().djCode).toBeDefined();
    expect(res.json().vjCode).toBeDefined();
  });

  it("POST /api/v1/sessions/code pushes code for active agent", async () => {
    const { app } = buildApp();
    const apiKey = await registerAgent(app, "dj-push");
    await app.inject({
      method: "POST", url: "/api/v1/slots/book",
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { type: "dj" },
    });
    const res = await app.inject({
      method: "POST", url: "/api/v1/sessions/code",
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { type: "dj", code: 'note("e4")' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it("GET /api/v1/chat/recent returns messages", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/chat/recent" });
    expect(res.statusCode).toBe(200);
    expect(res.json().messages).toEqual([]);
  });

  it("POST /api/v1/chat/send adds message", async () => {
    const { app } = buildApp();
    const apiKey = await registerAgent(app, "chatter");
    const res = await app.inject({
      method: "POST", url: "/api/v1/chat/send",
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { text: "hello club!" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().from).toBe("chatter");
    expect(res.json().text).toBe("hello club!");
  });
});
