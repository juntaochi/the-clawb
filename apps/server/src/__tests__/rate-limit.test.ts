import { describe, it, expect, vi, afterEach } from "vitest";
import { PerKeyRateLimiter } from "../rate-limit.js";

describe("PerKeyRateLimiter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("allows the first call", () => {
    const limiter = new PerKeyRateLimiter(1000);
    expect(limiter.allow("a")).toBe(true);
  });

  it("blocks a second call within the interval", () => {
    const limiter = new PerKeyRateLimiter(1000);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    expect(limiter.allow("a")).toBe(true);

    // Still within the 1000ms window
    vi.spyOn(Date, "now").mockReturnValue(now + 500);
    expect(limiter.allow("a")).toBe(false);
  });

  it("allows a call after the interval has passed", () => {
    const limiter = new PerKeyRateLimiter(1000);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    expect(limiter.allow("a")).toBe(true);

    // Exactly at the interval boundary — should still be blocked
    vi.spyOn(Date, "now").mockReturnValue(now + 999);
    expect(limiter.allow("a")).toBe(false);

    // Past the interval
    vi.spyOn(Date, "now").mockReturnValue(now + 1000);
    expect(limiter.allow("a")).toBe(true);
  });

  it("tracks different keys independently", () => {
    const limiter = new PerKeyRateLimiter(1000);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("b")).toBe(true);

    // "a" is blocked, "b" is also blocked — both just fired
    expect(limiter.allow("a")).toBe(false);
    expect(limiter.allow("b")).toBe(false);

    // Advance past interval — both allowed again
    vi.spyOn(Date, "now").mockReturnValue(now + 1001);
    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("b")).toBe(true);
  });

  it("remove() clears a key so the next call is allowed", () => {
    const limiter = new PerKeyRateLimiter(1000);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(false);

    limiter.remove("a");

    // Should be allowed immediately after removal
    expect(limiter.allow("a")).toBe(true);
  });

  it("remove() is a no-op for unknown keys", () => {
    const limiter = new PerKeyRateLimiter(1000);
    // Should not throw
    limiter.remove("nonexistent");
  });
});
