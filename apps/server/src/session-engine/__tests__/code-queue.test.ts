import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CodeQueue } from "../code-queue.js";
import type { SlotType } from "@the-clawb/shared";

describe("CodeQueue", () => {
  let dripped: { type: SlotType; code: string }[];
  let queue: CodeQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    dripped = [];
    queue = new CodeQueue(
      { maxDepth: 3, intervalMs: 5_000 },
      (type, code) => dripped.push({ type, code }),
    );
  });

  afterEach(() => {
    queue.destroy();
    vi.useRealTimers();
  });

  it("enqueues items and reports depth", () => {
    const r1 = queue.enqueue("dj", "code-1");
    expect(r1).toEqual({ position: 1, depth: 1 });
    expect(queue.depth("dj")).toBe(1);

    const r2 = queue.enqueue("dj", "code-2");
    expect(r2).toEqual({ position: 2, depth: 2 });
    expect(queue.depth("dj")).toBe(2);
  });

  it("rejects when queue is full", () => {
    queue.enqueue("dj", "a");
    queue.enqueue("dj", "b");
    queue.enqueue("dj", "c");
    const result = queue.enqueue("dj", "overflow");
    expect(result).toHaveProperty("error");
  });

  it("drips items in FIFO order at correct intervals", () => {
    queue.enqueue("dj", "first");
    queue.enqueue("dj", "second");

    expect(dripped).toHaveLength(0);

    vi.advanceTimersByTime(5_000);
    expect(dripped).toEqual([{ type: "dj", code: "first" }]);
    expect(queue.depth("dj")).toBe(1);

    vi.advanceTimersByTime(5_000);
    expect(dripped).toEqual([
      { type: "dj", code: "first" },
      { type: "dj", code: "second" },
    ]);
    expect(queue.depth("dj")).toBe(0);
  });

  it("stops timer when queue empties", () => {
    queue.enqueue("dj", "only-one");

    vi.advanceTimersByTime(5_000);
    expect(dripped).toHaveLength(1);

    // No more drips after queue empty
    vi.advanceTimersByTime(10_000);
    expect(dripped).toHaveLength(1);
  });

  it("clear discards items and cancels timer", () => {
    queue.enqueue("dj", "a");
    queue.enqueue("dj", "b");
    queue.clear("dj");

    expect(queue.depth("dj")).toBe(0);

    vi.advanceTimersByTime(10_000);
    expect(dripped).toHaveLength(0);
  });

  it("manages DJ and VJ queues independently", () => {
    queue.enqueue("dj", "dj-code");
    queue.enqueue("vj", "vj-code");

    vi.advanceTimersByTime(5_000);
    expect(dripped).toEqual([
      { type: "dj", code: "dj-code" },
      { type: "vj", code: "vj-code" },
    ]);
  });

  it("destroy cleans up all timers", () => {
    queue.enqueue("dj", "a");
    queue.enqueue("vj", "b");
    queue.destroy();

    vi.advanceTimersByTime(10_000);
    expect(dripped).toHaveLength(0);
  });
});
