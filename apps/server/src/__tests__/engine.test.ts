import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionEngine } from "../session-engine/engine.js";
import type { SessionConfig } from "@the-clawb/shared";

const config: SessionConfig = {
  durationMs: 60_000,
  warningMs: 10_000,
  minPushIntervalMs: 1000,
  maxBpmDelta: 15,
};

describe("SessionEngine", () => {
  let engine: SessionEngine;
  let onEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onEvent = vi.fn();
    engine = new SessionEngine(config, onEvent);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with idle slots and default code", () => {
    const state = engine.getClubState();
    expect(state.dj.status).toBe("idle");
    expect(state.vj.status).toBe("idle");
    expect(state.dj.code).toContain("note");
    expect(state.vj.code).toContain("osc");
  });

  it("books a slot and queues agent", () => {
    const result = engine.bookSlot("agent-1", "DJ One", "dj");
    expect(result.position).toBe(0);
  });

  it("activates session when slot is idle and agent is next in queue", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    const state = engine.getClubState();
    expect(state.dj.status).toBe("active");
    expect(state.dj.agent?.name).toBe("DJ One");
  });

  it("session:start event includes current code snapshot", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    expect(onEvent).toHaveBeenCalledWith("session:start", expect.objectContaining({
      type: "dj",
      code: expect.any(String),
    }));
  });

  it("accepts code push from active agent", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    const result = engine.pushCode("agent-1", { type: "dj", code: 'note("c4")' });
    expect(result.ok).toBe(true);
    expect(engine.getClubState().dj.code).toBe('note("c4")');
  });

  it("rejects code push from non-active agent", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    const result = engine.pushCode("agent-2", { type: "dj", code: "hack" });
    expect(result.ok).toBe(false);
  });

  it("queues second agent when slot is occupied", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.bookSlot("agent-2", "DJ Two", "dj");
    engine.processQueue();
    const state = engine.getClubState();
    expect(state.dj.agent?.name).toBe("DJ One");
    expect(state.queue).toHaveLength(1);
    expect(state.queue[0].agentName).toBe("DJ Two");
  });

  it("enforces minimum push interval", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    engine.pushCode("agent-1", { type: "dj", code: "code1" });
    const result = engine.pushCode("agent-1", { type: "dj", code: "code2" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Too fast");
  });

  it("fires session:warning before session ends", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    vi.advanceTimersByTime(50_000); // 60s - 10s warning = 50s
    expect(onEvent).toHaveBeenCalledWith("session:warning", expect.objectContaining({
      type: "dj",
      endsIn: 10_000,
    }));
  });

  it("auto-ends session after duration expires", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    vi.advanceTimersByTime(60_000);
    expect(onEvent).toHaveBeenCalledWith("session:end", { type: "dj" });
    expect(engine.getClubState().dj.status).toBe("idle");
  });

  it("next agent gets current code after previous session ends", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.bookSlot("agent-2", "DJ Two", "dj");
    engine.processQueue();
    engine.pushCode("agent-1", { type: "dj", code: 'note("custom")' });
    vi.advanceTimersByTime(60_000); // session ends, DJ Two takes over
    const startCalls = onEvent.mock.calls.filter((call) => call[0] === "session:start");
    const lastStart = startCalls[startCalls.length - 1];
    expect(lastStart[1].code).toBe('note("custom")');
  });
});
