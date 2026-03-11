import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "../app.js";

describe("agent registration", () => {
  const originalAdminSecret = process.env.ADMIN_SECRET;

  afterEach(() => {
    if (originalAdminSecret === undefined) {
      delete process.env.ADMIN_SECRET;
    } else {
      process.env.ADMIN_SECRET = originalAdminSecret;
    }
  });
  it("POST /api/v1/agents/register creates agent and returns apiKey", async () => {
    const { app } = buildApp();
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
    const { app } = buildApp();
    await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: { name: "dupe" } });
    const res = await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: { name: "dupe" } });
    expect(res.statusCode).toBe(409);
  });

  it("rejects missing name", async () => {
    const { app } = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it("strips HTML from name", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "<b>cool</b>-dj" },
    });
    expect(res.statusCode).toBe(201);
    // Verify the stored name has HTML stripped by registering again (conflict check)
    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "cool-dj" },
    });
    expect(res2.statusCode).toBe(409);
  });

  it("rejects names empty after HTML sanitization", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "<img src=x>" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects names longer than 30 chars", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "a".repeat(31) },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("name must be at most 30 characters");
  });

  it("rejects registration without admin secret when ADMIN_SECRET is set", async () => {
    process.env.ADMIN_SECRET = "s3cret";
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "sneaky-agent" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("Admin secret required for registration");
  });

  it("accepts registration with correct admin secret", async () => {
    process.env.ADMIN_SECRET = "s3cret";
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "legit-agent" },
      headers: { "x-admin-secret": "s3cret" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.apiKey).toMatch(/^rave_/);
    expect(body.agentId).toBeDefined();
  });

  it("allows open registration when ADMIN_SECRET is not set", async () => {
    delete process.env.ADMIN_SECRET;
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "open-agent" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.apiKey).toMatch(/^rave_/);
    expect(body.agentId).toBeDefined();
  });
});
