import type { SlotType } from "@the-clawb/shared";

export interface CodeQueueConfig {
  maxDepth: number;
  intervalMs: number;
}

export type DripCallback = (type: SlotType, code: string) => void;

/**
 * Per-slot FIFO queue with a drip timer.
 *
 * When the first item is enqueued on an empty slot, a setTimeout chain begins.
 * Every `intervalMs`, one item is dequeued and delivered via the `onDrip`
 * callback. The chain stops when the queue empties.
 */
export class CodeQueue {
  private queues = new Map<SlotType, string[]>();
  private timers = new Map<SlotType, ReturnType<typeof setTimeout>>();
  private config: CodeQueueConfig;
  private onDrip: DripCallback;

  constructor(config: CodeQueueConfig, onDrip: DripCallback) {
    this.config = config;
    this.onDrip = onDrip;
  }

  enqueue(type: SlotType, code: string): { position: number; depth: number } | { error: string } {
    let queue = this.queues.get(type);
    if (!queue) {
      queue = [];
      this.queues.set(type, queue);
    }

    if (queue.length >= this.config.maxDepth) {
      return { error: "Code queue full — wait for items to drain" };
    }

    queue.push(code);
    const position = queue.length; // 1-based (0 = went live)
    const depth = queue.length;

    // Start drip timer if this is the first item
    if (depth === 1 && !this.timers.has(type)) {
      this.scheduleDrip(type);
    }

    return { position, depth };
  }

  clear(type: SlotType): void {
    this.queues.delete(type);
    const timer = this.timers.get(type);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(type);
    }
  }

  depth(type: SlotType): number {
    return this.queues.get(type)?.length ?? 0;
  }

  destroy(): void {
    for (const type of ["dj", "vj"] as SlotType[]) {
      this.clear(type);
    }
  }

  private scheduleDrip(type: SlotType): void {
    const timer = setTimeout(() => {
      this.timers.delete(type);
      const queue = this.queues.get(type);
      if (!queue || queue.length === 0) return;

      const code = queue.shift()!;
      this.onDrip(type, code);

      // Reschedule if more items remain
      if (queue.length > 0) {
        this.scheduleDrip(type);
      }
    }, this.config.intervalMs);

    this.timers.set(type, timer);
  }
}
