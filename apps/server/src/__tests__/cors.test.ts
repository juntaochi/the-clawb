import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../app.js";

describe("CORS configuration", () => {
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  afterEach(() => {
    // Restore original env
    if (originalCorsOrigin !== undefined) {
      process.env.CORS_ORIGIN = originalCorsOrigin;
    } else {
      delete process.env.CORS_ORIGIN;
    }
  });

  describe("when CORS_ORIGIN is set", () => {
    beforeEach(() => {
      process.env.CORS_ORIGIN = "https://theclawb.dev";
    });

    it("allows requests from the configured origin", async () => {
      const { app } = buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "https://theclawb.dev" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(
        "https://theclawb.dev",
      );
    });

    it("does not reflect a disallowed origin", async () => {
      const { app } = buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "https://evil.example.com" },
      });
      // Fastify CORS with a string origin will not reflect a mismatched origin
      expect(res.headers["access-control-allow-origin"]).not.toBe(
        "https://evil.example.com",
      );
    });

    it("preflight from disallowed origin is rejected", async () => {
      const { app } = buildApp();
      const res = await app.inject({
        method: "OPTIONS",
        url: "/health",
        headers: {
          origin: "https://evil.example.com",
          "access-control-request-method": "GET",
        },
      });
      expect(res.headers["access-control-allow-origin"]).not.toBe(
        "https://evil.example.com",
      );
    });
  });

  describe("when CORS_ORIGIN is not set (dev mode)", () => {
    beforeEach(() => {
      delete process.env.CORS_ORIGIN;
    });

    it("reflects any origin (permissive for local dev)", async () => {
      const { app } = buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "http://localhost:3000" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000",
      );
    });

    it("reflects arbitrary origin (permissive for local dev)", async () => {
      const { app } = buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "https://anything.example.com" },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe(
        "https://anything.example.com",
      );
    });
  });
});
