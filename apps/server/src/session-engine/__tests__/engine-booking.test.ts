import { describe, it, expect, beforeEach } from "vitest";
import { SessionEngine } from "../engine.js";
import { createEventBus } from "../../event-bus.js";

const testConfig = {
  durationMs: 60_000,
  warningMs: 10_000,
  minPushIntervalMs: 1000,
  maxBpmDelta: 15,
};

describe("SessionEngine booking protections", () => {
  let engine: SessionEngine;

  beforeEach(() => {
    engine = new SessionEngine(testConfig, createEventBus());
  });

  it("prevents agent from booking both DJ and VJ simultaneously", () => {
    engine.bookSlot("agent-1", "DJ Bot", "dj");
    const result = engine.bookSlot("agent-1", "DJ Bot", "vj");
    expect(result).toHaveProperty("error");
  });

  it("allows different agents to book different slots", () => {
    engine.bookSlot("agent-1", "DJ Bot", "dj");
    const result = engine.bookSlot("agent-2", "VJ Bot", "vj");
    expect(result).toHaveProperty("position");
    expect(result).not.toHaveProperty("error");
  });

  it("prevents booking when queue is full (max 20)", () => {
    for (let i = 0; i < 20; i++) {
      engine.bookSlot(`agent-${i}`, `Bot ${i}`, "dj");
    }
    const result = engine.bookSlot("agent-overflow", "Overflow", "dj");
    expect(result).toHaveProperty("error");
  });

  it("still allows idempotent re-booking of same slot", () => {
    engine.bookSlot("agent-1", "DJ Bot", "dj");
    const result = engine.bookSlot("agent-1", "DJ Bot", "dj");
    expect(result).toHaveProperty("position");
    expect(result).not.toHaveProperty("error");
  });

  it("prevents booking if agent is currently performing", () => {
    engine.bookSlot("agent-1", "DJ Bot", "dj");
    engine.processQueue(); // starts the session
    const result = engine.bookSlot("agent-1", "DJ Bot", "vj");
    expect(result).toHaveProperty("error");
  });
});
