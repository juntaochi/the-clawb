import { describe, it, expect, vi } from "vitest";
import { createEventBus } from "../event-bus.js";

describe("ClubEventBus", () => {
  it("emits and receives events", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on("code:update", handler);
    bus.emit("code:update", { type: "dj", code: 'note("c4")', agentName: "test" });
    expect(handler).toHaveBeenCalledWith({ type: "dj", code: 'note("c4")', agentName: "test" });
  });

  it("supports multiple subscribers on the same event", () => {
    const bus = createEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on("session:start", h1);
    bus.on("session:start", h2);
    bus.emit("session:start", { type: "dj" });
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it("off() removes a listener", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on("session:end", handler);
    bus.off("session:end", handler);
    bus.emit("session:end", { type: "dj" });
    expect(handler).not.toHaveBeenCalled();
  });
});
