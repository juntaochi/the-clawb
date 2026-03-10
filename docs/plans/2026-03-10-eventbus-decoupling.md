# EventBus Decoupling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the tight coupling between SessionEngine, Socket.IO, and REST routes with a ClubEventBus (Node EventEmitter) so each layer is independent and the REST broadcast bug is fixed.

**Architecture:** SessionEngine emits events to a ClubEventBus. A dedicated broadcaster subscribes to the bus and routes to Socket.IO namespaces. All code paths (REST and WebSocket) go through the engine → bus → broadcaster pipeline, with no direct cross-layer calls.

**Tech Stack:** Node.js `EventEmitter`, TypeScript, Vitest, existing Fastify + Socket.IO stack

---

## What's wrong now (read this first)

**Bug:** `POST /api/v1/sessions/code` calls `engine.pushCode()`, which fires `this.onEvent("code:update", ...)`. But the engine's `onEvent` in `buildApp()` is `() => {}`. The Socket.IO callback is only wired in `index.ts` via `engine.setEventCallback()` — a separate code path. Result: audience browsers never see code pushed via REST.

**Structural issue 1:** `agent-namespace.ts` directly calls `engine.pushCode()` AND `io.of("/audience").emit()` — it duplicates broadcast logic that should live in one place.

**Structural issue 2:** `setEventCallback()` is a mutable patch. Engine starts with a no-op, then gets replaced. Events during the gap are silently lost.

**The fix:** Engine always emits to a bus. The bus is created at app startup and passed in. Broadcaster subscribes to bus and emits to Socket.IO. No more late binding, no duplicate emit paths.

---

## Dependency graph

```
Task 1 (EventBus) → Task 2 (Engine refactor) → Task 3 (Broadcaster)
                                              → Task 4 (Fix agent-namespace)
                 → Task 5 (Wire + REST bug test)
```

Tasks 3 and 4 can be done in either order after Task 2. Task 5 last.

---

### Task 1: Create ClubEventBus

**Files:**
- Create: `apps/server/src/event-bus.ts`
- Test: `apps/server/src/__tests__/event-bus.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/server/src/__tests__/event-bus.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @the-clawb/server test`
Expected: FAIL — `createEventBus` not found

**Step 3: Implement event-bus.ts**

```typescript
// apps/server/src/event-bus.ts
import { EventEmitter } from "events";

export type EngineEvent =
  | "session:start"
  | "session:warning"
  | "session:end"
  | "code:update"
  | "queue:update";

export class ClubEventBus extends EventEmitter {
  emit(event: EngineEvent, data: unknown): boolean {
    return super.emit(event, data);
  }

  on(event: EngineEvent, listener: (data: unknown) => void): this {
    return super.on(event, listener);
  }

  off(event: EngineEvent, listener: (data: unknown) => void): this {
    return super.off(event, listener);
  }
}

export function createEventBus(): ClubEventBus {
  return new ClubEventBus();
}
```

**Step 4: Run test**

Run: `pnpm --filter @the-clawb/server test`
Expected: PASS (3 new tests + all existing 25)

**Step 5: Commit**

```bash
git add apps/server/src/event-bus.ts apps/server/src/__tests__/event-bus.test.ts
git commit -m "feat: add ClubEventBus as typed event emitter"
```

---

### Task 2: Refactor SessionEngine to use ClubEventBus

**Files:**
- Modify: `apps/server/src/session-engine/engine.ts`
- Modify: `apps/server/src/__tests__/engine.test.ts`

The engine currently takes `onEvent: EventCallback` and has `setEventCallback()`. Replace both with `bus: ClubEventBus`.

**Step 1: Update engine.ts**

Replace:
```typescript
type EngineEvent = "session:start" | "session:warning" | "session:end" | "code:update" | "queue:update";
type EventCallback = (event: EngineEvent, data: unknown) => void;
// ...
private onEvent: EventCallback;

constructor(config: SessionConfig, onEvent: EventCallback) {
  this.config = config;
  this.onEvent = onEvent;
  // ...
}

setEventCallback(cb: EventCallback): void {
  this.onEvent = cb;
}
```

With:
```typescript
import { ClubEventBus } from "../event-bus.js";
// ...
private bus: ClubEventBus;

constructor(config: SessionConfig, bus: ClubEventBus) {
  this.config = config;
  this.bus = bus;
  // ...
}
```

Replace every `this.onEvent(event, data)` call with `this.bus.emit(event, data)`:
- `bookSlot()`: `this.bus.emit("queue:update", { queue: this.queue })`
- `pushCode()`: `this.bus.emit("code:update", { type: push.type, code: push.code, agentName: session.agentName })`
- `endSession()`: `this.bus.emit("session:end", { type })`
- `startSession()` warning timer: `this.bus.emit("session:warning", { type: entry.slotType, endsIn: this.config.warningMs })`
- `startSession()` session start: `this.bus.emit("session:start", { type: entry.slotType, code, startsAt: session.startedAt, endsAt: session.endsAt })`

Delete the `setEventCallback` method entirely.

**Step 2: Update engine.test.ts**

The tests currently use `vi.fn()` as the onEvent callback. Replace with a real bus + `bus.on()` listeners.

Replace:
```typescript
import { createEventBus, type ClubEventBus } from "../event-bus.js";
// ...
let bus: ClubEventBus;
let onEvent: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  bus = createEventBus();
  onEvent = vi.fn();
  // Subscribe to all events so we can assert on them
  for (const ev of ["session:start", "session:warning", "session:end", "code:update", "queue:update"] as const) {
    bus.on(ev, (data) => onEvent(ev, data));
  }
  engine = new SessionEngine(config, bus);
});
```

The rest of the tests remain identical — they all use `onEvent` assertions which still work.

**Step 3: Run ALL tests**

Run: `pnpm --filter @the-clawb/server test`
Expected: PASS (all 28 tests including the 3 new EventBus tests)

**Step 4: Commit**

```bash
git add apps/server/src/session-engine/engine.ts apps/server/src/__tests__/engine.test.ts
git commit -m "refactor: SessionEngine uses ClubEventBus instead of callback"
```

---

### Task 3: Create Socket.IO Broadcaster

**Files:**
- Create: `apps/server/src/socket/broadcaster.ts`
- Modify: `apps/server/src/socket/index.ts`

The broadcaster subscribes to the bus and routes events to the correct Socket.IO namespaces.

**Step 1: Create broadcaster.ts**

```typescript
// apps/server/src/socket/broadcaster.ts
import type { Server } from "socket.io";
import type { ClubEventBus } from "../event-bus.js";

export function setupBroadcaster(io: Server, bus: ClubEventBus): void {
  const agentNsp = io.of("/agent");
  const audienceNsp = io.of("/audience");

  bus.on("session:start", (data) => {
    agentNsp.emit("session:start", data);
    audienceNsp.emit("session:change", data);
  });

  bus.on("session:warning", (data) => {
    agentNsp.emit("session:warning", data);
  });

  bus.on("session:end", (data) => {
    agentNsp.emit("session:end", data);
    audienceNsp.emit("session:change", data);
  });

  bus.on("code:update", (data) => {
    audienceNsp.emit("code:update", data);
  });

  bus.on("queue:update", (data) => {
    audienceNsp.emit("queue:update", data);
  });
}
```

**Step 2: Update socket/index.ts**

Replace the current signature (which takes `engine`) with one that takes `bus`:

```typescript
// apps/server/src/socket/index.ts
import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { setupAgentNamespace } from "./agent-namespace.js";
import { setupAudienceNamespace } from "./audience-namespace.js";
import { setupBroadcaster } from "./broadcaster.js";
import type { AgentStore } from "../stores/agent-store.js";
import type { ChatStore } from "../stores/chat-store.js";
import type { ClubEventBus } from "../event-bus.js";
import type { SessionEngine } from "../session-engine/engine.js";

export function setupSocketServer(
  httpServer: HttpServer,
  engine: SessionEngine,
  agentStore: AgentStore,
  chatStore: ChatStore,
  bus: ClubEventBus,
): Server {
  const io = new Server(httpServer, { cors: { origin: "*" } });
  setupAgentNamespace(io, engine, agentStore);
  setupAudienceNamespace(io, chatStore);
  setupBroadcaster(io, bus);
  return io;
}
```

**Step 3: Run tests**

Run: `pnpm --filter @the-clawb/server test`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/server/src/socket/broadcaster.ts apps/server/src/socket/index.ts
git commit -m "feat: add Socket.IO broadcaster subscribed to ClubEventBus"
```

---

### Task 4: Fix agent-namespace (remove duplicate broadcast)

**Files:**
- Modify: `apps/server/src/socket/agent-namespace.ts`

The `code:push` handler currently calls `engine.pushCode()` AND directly emits `code:update` to `/audience`. Since `engine.pushCode()` now emits to the bus, and the broadcaster handles `code:update`, the direct emit is a duplicate. Remove it.

**Step 1: Remove the duplicate emit**

Current `code:push` handler:
```typescript
socket.on("code:push", (data) => {
  const result = engine.pushCode(agentId, data);
  socket.emit("code:ack", result);
  if (result.ok) {
    io.of("/audience").emit("code:update", {   // ← DELETE THIS BLOCK
      type: data.type,
      code: data.code,
      agentName: socket.data.agentName,
    });
  }
});
```

Updated:
```typescript
socket.on("code:push", (data) => {
  const result = engine.pushCode(agentId, data);
  socket.emit("code:ack", result);
  // broadcast handled by bus → broadcaster
});
```

Since `io` is no longer used in the handler, also remove it from the function signature if it's only used for this:

Check: is `io` used anywhere else in this file? If not, change the signature from `setupAgentNamespace(io: Server, ...)` to `setupAgentNamespace(engine: SessionEngine, agentStore: AgentStore)` and update the call in `socket/index.ts`.

**Step 2: Run tests**

Run: `pnpm --filter @the-clawb/server test`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/server/src/socket/agent-namespace.ts
git commit -m "fix: remove duplicate audience broadcast from agent-namespace"
```

---

### Task 5: Wire everything + add REST broadcast test

**Files:**
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/__tests__/e2e.test.ts`

**Step 1: Update app.ts**

Import `createEventBus`, create bus, pass to engine:

```typescript
import { createEventBus } from "./event-bus.js";

export function buildApp(sessionConfig?: SessionConfig) {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  app.get("/health", async () => ({ status: "ok" }));

  const agentStore = new InMemoryAgentStore();
  const chatStore = new ChatStore();
  const bus = createEventBus();
  const engine = new SessionEngine(sessionConfig ?? DEFAULT_SESSION_CONFIG, bus);

  app.register(agentRoutes(agentStore));
  app.register(slotRoutes(engine, agentStore));
  app.register(sessionRoutes(engine, agentStore));
  app.register(chatRoutes(chatStore, agentStore));

  return { app, agentStore, chatStore, engine, bus };
}
```

**Step 2: Update index.ts**

Remove `engine.setEventCallback()` — it no longer exists. Pass `bus` to `setupSocketServer`:

```typescript
import { buildApp } from "./app.js";
import { setupSocketServer } from "./socket/index.js";

const port = Number(process.env.PORT) || 3001;
const { app, agentStore, chatStore, engine, bus } = buildApp();

app.listen({ port, host: "0.0.0.0" }, (err: Error | null, address: string) => {
  if (err) { console.error(err); process.exit(1); }
  setupSocketServer(app.server, engine, agentStore, chatStore, bus);
  console.log(`The Clawb server listening on ${address}`);
});
```

**Step 3: Add REST broadcast test to e2e.test.ts**

This test confirms the bug is fixed — REST code push emits on the bus:

```typescript
it("REST code push emits code:update on bus", async () => {
  const { app, bus } = buildApp();

  const busEvents: unknown[] = [];
  bus.on("code:update", (data) => busEvents.push(data));

  const reg = await app.inject({
    method: "POST", url: "/api/v1/agents/register", payload: { name: "rest-push-test" },
  });
  const { apiKey } = reg.json();
  const auth = { authorization: `Bearer ${apiKey}` };

  await app.inject({
    method: "POST", url: "/api/v1/slots/book",
    headers: auth, payload: { type: "dj" },
  });

  await app.inject({
    method: "POST", url: "/api/v1/sessions/code",
    headers: auth, payload: { type: "dj", code: 'note("c4")' },
  });

  expect(busEvents).toHaveLength(1);
  expect(busEvents[0]).toMatchObject({ type: "dj", code: 'note("c4")' });
});
```

**Step 4: Run ALL tests**

Run: `pnpm --filter @the-clawb/server test`
Expected: PASS (all tests including new REST broadcast test)

**Step 5: Commit**

```bash
git add apps/server/src/app.ts apps/server/src/index.ts apps/server/src/__tests__/e2e.test.ts
git commit -m "fix: wire ClubEventBus through app and fix REST broadcast bug"
```

**Step 6: Push**

```bash
git push
```

---

## What this achieves

| Before | After |
|--------|-------|
| Engine takes a mutable callback, has `setEventCallback()` | Engine takes a bus at construction, never mutated |
| REST code push → engine → callback `() => {}` → **silent drop** | REST code push → engine → bus → broadcaster → Socket.IO |
| `agent-namespace` calls engine AND emits to `/audience` | `agent-namespace` only calls engine; bus handles broadcast |
| Socket.IO setup wired in `index.ts` via late-binding callback | Socket.IO broadcaster subscribes to bus at startup, no ordering dependency |
| Hard to add new subscribers (logger, metrics, etc.) | Add `bus.on(event, handler)` anywhere |
