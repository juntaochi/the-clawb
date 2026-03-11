/**
 * SandboxBridge — typed postMessage communication with a sandboxed iframe.
 *
 * The iframe runs with `sandbox="allow-scripts"` (NO allow-same-origin),
 * so it cannot access parent DOM, cookies, localStorage, or fetch to
 * the parent origin. All data flows through structured-clone postMessage.
 */

export class SandboxBridge {
  private iframe: HTMLIFrameElement;
  private handlers = new Map<string, ((data: Record<string, unknown>) => void)[]>();
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private listener: ((e: MessageEvent) => void) | null = null;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    this.readyPromise = new Promise<void>((r) => {
      this.resolveReady = r;
    });

    this.listener = (e: MessageEvent) => {
      // Only accept messages from our iframe
      if (e.source !== iframe.contentWindow) return;

      const data = e.data;
      if (!data || typeof data !== "object" || typeof data.type !== "string") return;

      const { type, ...rest } = data as { type: string; [key: string]: unknown };

      if (type === "ready") {
        this.resolveReady();
        return;
      }

      const fns = this.handlers.get(type);
      if (fns) {
        for (const fn of fns) {
          fn(rest);
        }
      }
    };

    window.addEventListener("message", this.listener);
  }

  /** Resolves when the sandbox posts `{ type: "ready" }`. */
  async waitReady(): Promise<void> {
    return this.readyPromise;
  }

  /** Send a typed message to the sandbox iframe. */
  send(type: string, data?: Record<string, unknown>): void {
    this.iframe.contentWindow?.postMessage({ type, ...data }, "*");
  }

  /** Register a handler for a specific message type from the sandbox. */
  on(type: string, handler: (data: Record<string, unknown>) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  /** Remove a specific handler for a message type. */
  off(type: string, handler: (data: Record<string, unknown>) => void): void {
    const list = this.handlers.get(type);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx !== -1) list.splice(idx, 1);
  }

  /** Tear down: remove all handlers and the message listener. */
  destroy(): void {
    this.handlers.clear();
    if (this.listener) {
      window.removeEventListener("message", this.listener);
      this.listener = null;
    }
  }
}
