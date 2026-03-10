import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

describe("agent registration", () => {
  it("POST /api/v1/agents/register creates agent and returns apiKey", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "test-dj" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.apiKey).toMatch(/^rave_/);
    expect(body.agentId).toBeDefined();
  });

  it("rejects duplicate names", async () => {
    const app = buildApp();
    await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: { name: "dupe" } });
    const res = await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: { name: "dupe" } });
    expect(res.statusCode).toBe(409);
  });

  it("rejects missing name", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: {} });
    expect(res.statusCode).toBe(400);
  });
});
