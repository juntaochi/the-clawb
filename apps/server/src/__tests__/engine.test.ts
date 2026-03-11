import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionEngine } from "../session-engine/engine.js";
import { createEventBus, type ClubEventBus } from "../event-bus.js";
import type { SessionConfig } from "@the-clawb/shared";

const config: SessionConfig = {
  durationMs: 60_000,
  warningMs: 10_000,
  minPushIntervalMs: 1000,
  maxBpmDelta: 15,
  codeQueueIntervalMs: 5_000,
  codeQueueMaxDepth: 5,
};

describe("SessionEngine", () => {
  let engine: SessionEngine;
  let bus: ClubEventBus;
  let onEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = createEventBus();
    onEvent = vi.fn();
    for (const ev of ["session:start", "session:warning", "session:end", "code:update", "queue:update"] as const) {
      bus.on(ev, (data) => onEvent(ev, data));
    }
    engine = new SessionEngine(config, bus);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with idle slots and default code", () => {
    const state = engine.getClubState();
    expect(state.dj.status).toBe("idle");
    expect(state.vj.status).toBe("idle");
    expect(state.dj.code).toContain("note");
    expect(state.vj.code).toContain("shape");
  });

  it("books a slot and queues agent", () => {
    const result = engine.bookSlot("agent-1", "DJ One", "dj");
    expect(result).toHaveProperty("position", 0);
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
    expect(onEvent).toHaveBeenCalledWith(
      "session:end",
      expect.objectContaining({ type: "dj" }),
    );
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

  // --- Code Queue behavior ---

  it("first push on empty queue goes live immediately", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    const result = engine.pushCode("agent-1", { type: "dj", code: "live-now" });
    expect(result).toEqual({ ok: true, queued: 0, queueDepth: 0 });
    expect(engine.getClubState().dj.code).toBe("live-now");
  });

  it("second push within interval goes to queue", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    engine.pushCode("agent-1", { type: "dj", code: "first" });
    // Advance past minPushIntervalMs (1s) but not codeQueueIntervalMs (5s)
    vi.advanceTimersByTime(1500);
    const result = engine.pushCode("agent-1", { type: "dj", code: "second" });
    expect(result).toEqual({ ok: true, queued: 1, queueDepth: 1 });
    // Live code is still "first"
    expect(engine.getClubState().dj.code).toBe("first");
  });

  it("queued code drips to live after interval", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    engine.pushCode("agent-1", { type: "dj", code: "first" });
    vi.advanceTimersByTime(1500);
    engine.pushCode("agent-1", { type: "dj", code: "second" });

    // Advance past codeQueueIntervalMs (5s) to trigger drip
    vi.advanceTimersByTime(5_000);
    expect(engine.getClubState().dj.code).toBe("second");
    expect(engine.getClubState().dj.codeQueueDepth).toBe(0);
  });

  it("immediate flag bypasses queue and clears pending", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    engine.pushCode("agent-1", { type: "dj", code: "first" });
    vi.advanceTimersByTime(1500);
    engine.pushCode("agent-1", { type: "dj", code: "queued" });

    vi.advanceTimersByTime(1500);
    const result = engine.pushCode("agent-1", { type: "dj", code: "urgent", immediate: true });
    expect(result).toEqual({ ok: true, queued: 0, queueDepth: 0 });
    expect(engine.getClubState().dj.code).toBe("urgent");
    expect(engine.getClubState().dj.codeQueueDepth).toBe(0);
  });

  it("session end clears code queue", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    engine.pushCode("agent-1", { type: "dj", code: "first" });
    vi.advanceTimersByTime(1500);
    engine.pushCode("agent-1", { type: "dj", code: "queued" });
    expect(engine.getClubState().dj.codeQueueDepth).toBe(1);

    engine.endSession("dj");
    // Queue should be cleared — no drip should happen
    vi.advanceTimersByTime(10_000);
    expect(engine.getClubState().dj.codeQueueDepth).toBe(0);
  });

  it("codeQueueDepth appears in getClubState", () => {
    engine.bookSlot("agent-1", "DJ One", "dj");
    engine.processQueue();
    expect(engine.getClubState().dj.codeQueueDepth).toBe(0);

    engine.pushCode("agent-1", { type: "dj", code: "first" });
    vi.advanceTimersByTime(1500);
    engine.pushCode("agent-1", { type: "dj", code: "q1" });
    vi.advanceTimersByTime(1500);
    engine.pushCode("agent-1", { type: "dj", code: "q2" });
    expect(engine.getClubState().dj.codeQueueDepth).toBe(2);
  });
});
