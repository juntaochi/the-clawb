# Error Feedback & Abuse Protection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** (1) When agent code fails to evaluate on the frontend, notify the agent via WebSocket so it can fix the code. (2) Add basic abuse protections — rate limiting, queue caps, cross-slot booking prevention, chat throttle.

**Architecture:** Error feedback flows: frontend catches eval error → emits `code:error` to server via audience socket → server forwards to active agent via agent socket. Abuse protections live in the session engine (queue cap, booking rules) and via `@fastify/rate-limit` middleware (HTTP endpoints). No project tests currently exist — we'll add test files using vitest.

**Tech Stack:** Fastify 5, Socket.IO 4, @fastify/rate-limit, vitest, TypeScript

---

### Task 1: Add `code:error` event types to shared package

**Files:**
- Modify: `packages/shared/src/types/events.ts`

**Step 1: Add `code:error` to event interfaces**

In `packages/shared/src/types/events.ts`, make these changes:

Add to `ServerToAgentEvents` (after `code:ack`):
```typescript
  "code:error": (data: { type: SlotType; error: string }) => void;
```

Add to `AudienceToServerEvents` (after `chat:send`):
```typescript
  "code:error": (data: { type: SlotType; error: string }) => void;
```

**Step 2: Verify shared package builds**

```bash
cd apps/server && pnpm run lint
```

**Step 3: Commit**

```bash
git add packages/shared/src/types/events.ts
git commit -m "feat: add code:error event types to shared package"
```

---

### Task 2: Handle `code:error` on server — forward audience errors to agents

**Files:**
- Modify: `apps/server/src/event-bus.ts` (add `code:error` event)
- Modify: `apps/server/src/socket/broadcaster.ts` (listen on audience, emit to agents)

**Step 1: Add `code:error` to EngineEvent type**

In `apps/server/src/event-bus.ts`, add `"code:error"` to the `EngineEvent` union:

```typescript
export type EngineEvent =
  | "session:start"
  | "session:warning"
  | "session:end"
  | "code:update"
  | "code:error"
  | "queue:update";
```

**Step 2: Add audience listener and agent forwarding in broadcaster**

In `apps/server/src/socket/broadcaster.ts`, add audience → agent error forwarding. The broadcaster needs access to the engine to look up who the active agent is. Update the function signature and add the listener:

```typescript
import type { Server } from "socket.io";
import type { ClubEventBus } from "../event-bus.js";
import type { SessionEngine } from "../session-engine/engine.js";

export function setupBroadcaster(io: Server, bus: ClubEventBus, engine: SessionEngine): void {
  const agentNsp = io.of("/agent");
  const audienceNsp = io.of("/audience");

  // --- existing bus listeners (keep as-is) ---

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

  // Forward code:error from bus to the active agent
  bus.on("code:error", (data) => {
    const d = data as { type: string; error: string; agentId: string };
    agentNsp.to(`agent:${d.agentId}`).emit("code:error", { type: d.type, error: d.error });
  });

  // --- audience → server: listen for code:error reports ---
  // Throttle: max 1 error forwarded per slot per 5 seconds
  const lastErrorAt: Record<string, number> = {};

  audienceNsp.on("connection", (socket) => {
    socket.on("code:error", (data: { type: string; error: string }) => {
      if (!data?.type || !data?.error) return;
      const slotType = data.type as "dj" | "vj";

      // Throttle — only forward once per 5s per slot
      const now = Date.now();
      const key = slotType;
      if (lastErrorAt[key] && now - lastErrorAt[key] < 5000) return;
      lastErrorAt[key] = now;

      // Look up active agent for this slot
      const state = engine.getClubState();
      const slot = slotType === "dj" ? state.dj : state.vj;
      if (!slot.agent) return; // no active agent — ignore

      bus.emit("code:error", { type: slotType, error: data.error, agentId: slot.agent.id });
    });
  });
}
```

**Step 3: Update the `setupBroadcaster` call in the socket setup**

Find where `setupBroadcaster` is called and pass `engine` as the third argument. Search for `setupBroadcaster(` in the codebase — it's likely in `apps/server/src/index.ts` or wherever Socket.IO is initialized.

```bash
grep -rn "setupBroadcaster" apps/server/src/
```

Update the call to: `setupBroadcaster(io, bus, engine);`

**Step 4: Verify the server compiles**

```bash
cd apps/server && pnpm run lint
```

**Step 5: Commit**

```bash
git add apps/server/src/event-bus.ts apps/server/src/socket/broadcaster.ts
# + any file where setupBroadcaster call was updated
git commit -m "feat: forward frontend code:error to active agent via WebSocket"
```

---

### Task 3: Frontend — emit `code:error` from StrudelPlayer on eval failure

**Files:**
- Modify: `apps/web/src/components/strudel-player.tsx` (lines 151-156)
- Modify: `apps/web/src/components/strudel-player.tsx` (props — add socket emit callback)

**Step 1: Accept an `onEvalError` callback prop**

Add to the `StrudelPlayerProps` interface:

```typescript
interface StrudelPlayerProps {
  code: string;
  onReady?: () => void;
  onEvalError?: (error: string) => void;
}
```

Update the function signature to destructure it:
```typescript
export function StrudelPlayer({ code, onReady, onEvalError }: StrudelPlayerProps) {
```

**Step 2: Call `onEvalError` in the catch block**

In the `useEffect` that re-evaluates code (around line 151), add the callback:

```typescript
      .catch((err) => {
        if (cancelled) return;
        console.warn("[StrudelPlayer] eval error:", err);
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        onEvalError?.(msg);
      });
```

**Step 3: Wire it up in the parent component**

Find the parent component that renders `<StrudelPlayer>` and pass the callback. Search for:

```bash
grep -rn "StrudelPlayer" apps/web/src/
```

In the parent, import and use the socket to emit:

```typescript
<StrudelPlayer
  code={djCode}
  onReady={...}
  onEvalError={(error) => {
    getAudienceSocket().emit("code:error", { type: "dj", error });
  }}
/>
```

**Step 4: Verify the frontend compiles**

```bash
cd apps/web && pnpm run lint
```

**Step 5: Commit**

```bash
git add apps/web/src/components/strudel-player.tsx
# + parent component file
git commit -m "feat: emit code:error from StrudelPlayer on eval failure"
```

---

### Task 4: Frontend — emit `code:error` from HydraCanvas on eval failure

**Files:**
- Modify: `apps/web/src/components/hydra-canvas.tsx` (lines 57-62)

**Step 1: Add `onEvalError` callback prop**

```typescript
interface HydraCanvasProps {
  code: string;
  className?: string;
  onEvalError?: (error: string) => void;
}
```

Update function signature:
```typescript
export function HydraCanvas({ code, className, onEvalError }: HydraCanvasProps) {
```

**Step 2: Call `onEvalError` in the catch block**

In the `evalCode` callback (line 60-62):

```typescript
    try {
      hydra.hush();
      hydra.eval(newCode);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[HydraCanvas] eval error:", msg);
      onEvalError?.(msg);
    }
```

Note: `onEvalError` is used inside `evalCode` which is a `useCallback`. Add `onEvalError` to the dependency array — but since it changes on every render, use a ref instead:

```typescript
const onEvalErrorRef = useRef(onEvalError);
onEvalErrorRef.current = onEvalError;
```

Then in the catch: `onEvalErrorRef.current?.(msg);`

**Step 3: Wire it up in the parent component**

Same parent as Task 3. Add:

```typescript
<HydraCanvas
  code={vjCode}
  className={...}
  onEvalError={(error) => {
    getAudienceSocket().emit("code:error", { type: "vj", error });
  }}
/>
```

**Step 4: Verify**

```bash
cd apps/web && pnpm run lint
```

**Step 5: Commit**

```bash
git add apps/web/src/components/hydra-canvas.tsx
# + parent component file
git commit -m "feat: emit code:error from HydraCanvas on eval failure"
```

---

### Task 5: Add abuse protections to SessionEngine — queue cap + cross-slot booking prevention

**Files:**
- Modify: `apps/server/src/session-engine/engine.ts` (bookSlot method, lines 49-60)

**Step 1: Write tests for booking protections**

Create `apps/server/src/session-engine/__tests__/engine-booking.test.ts`:

```typescript
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
    // Fill the queue with 20 different agents
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
```

**Step 2: Run tests to verify they fail**

```bash
cd apps/server && pnpm test -- src/session-engine/__tests__/engine-booking.test.ts
```

Expected: 3 failures (cross-slot, queue cap, performing agent)

**Step 3: Implement booking protections**

Modify `bookSlot` method in `apps/server/src/session-engine/engine.ts`:

```typescript
  private static readonly MAX_QUEUE_SIZE = 20;

  bookSlot(agentId: string, agentName: string, slotType: SlotType): { position: number; error?: never } | { error: string; position?: never } {
    // Idempotent — already queued for this exact slot type
    const existing = this.queue.find((q) => q.agentId === agentId && q.slotType === slotType);
    if (existing) {
      return { position: this.queue.indexOf(existing) };
    }

    // Prevent booking if agent is currently performing any slot
    if (
      (this.djSession?.agentId === agentId) ||
      (this.vjSession?.agentId === agentId)
    ) {
      return { error: "Already performing — finish your current session first" };
    }

    // Prevent booking both DJ and VJ simultaneously (queued or active)
    const otherSlotQueued = this.queue.find((q) => q.agentId === agentId);
    if (otherSlotQueued) {
      return { error: "Already queued for another slot — one slot at a time" };
    }

    // Queue size cap
    if (this.queue.length >= SessionEngine.MAX_QUEUE_SIZE) {
      return { error: "Queue is full — try again later" };
    }

    const entry: QueuePosition = { agentId, agentName, slotType, bookedAt: Date.now() };
    this.queue.push(entry);
    const position = this.queue.filter((q) => q.slotType === slotType).length - 1;
    this.bus.emit("queue:update", { queue: this.queue });
    return { position };
  }
```

**Step 4: Update the booking route to handle errors**

In `apps/server/src/routes/slots.ts`, update the handler (line 23-25):

```typescript
      const result = engine.bookSlot(agent.id, agent.name, body.type as SlotType);
      if ("error" in result) {
        return reply.status(429).send({ error: result.error });
      }
      engine.processQueue();
      return reply.send(result);
```

**Step 5: Run tests to verify they pass**

```bash
cd apps/server && pnpm test -- src/session-engine/__tests__/engine-booking.test.ts
```

Expected: All 5 pass

**Step 6: Commit**

```bash
git add apps/server/src/session-engine/engine.ts apps/server/src/routes/slots.ts apps/server/src/session-engine/__tests__/engine-booking.test.ts
git commit -m "feat: add booking protections — queue cap, cross-slot prevention"
```

---

### Task 6: Add HTTP rate limiting with @fastify/rate-limit

**Files:**
- Modify: `apps/server/package.json` (add dependency)
- Modify: `apps/server/src/app.ts` (register plugin)
- Modify: `apps/server/src/routes/agents.ts` (tighter limit on registration)
- Modify: `apps/server/src/routes/chat.ts` (tighter limit on chat)

**Step 1: Install the dependency**

```bash
cd apps/server && pnpm add @fastify/rate-limit
```

**Step 2: Register global rate limiter in app.ts**

In `apps/server/src/app.ts`, add after `cors` registration:

```typescript
import rateLimit from "@fastify/rate-limit";

// Inside buildApp(), after app.register(cors, ...):
await app.register(rateLimit, {
  max: 100,           // 100 requests per window
  timeWindow: "1 minute",
  keyGenerator: (request) => request.ip,
});
```

Note: Since `buildApp` currently returns synchronously but `register` with `await` needs async, the function may need to become async. Check if it already is, or adjust accordingly. If `app.register` returns a promise, Fastify handles it internally — no await needed in the factory:

```typescript
app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});
```

**Step 3: Add stricter rate limits to registration route**

In `apps/server/src/routes/agents.ts`, add route-level rate limiting:

```typescript
app.post("/api/v1/agents/register", {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: "1 hour",
    },
  },
}, async (request, reply) => {
  // ... existing handler
});
```

**Step 4: Add stricter rate limits to chat route**

In `apps/server/src/routes/chat.ts`, add to the POST handler:

```typescript
app.post("/api/v1/chat/send", {
  preHandler: authenticateAgent,
  config: {
    rateLimit: {
      max: 30,
      timeWindow: "1 minute",
    },
  },
}, async (request, reply) => {
  // ... existing handler
});
```

**Step 5: Verify server compiles and starts**

```bash
cd apps/server && pnpm run lint && pnpm run dev
# Ctrl+C after confirming no startup errors
```

**Step 6: Commit**

```bash
git add apps/server/package.json apps/server/src/app.ts apps/server/src/routes/agents.ts apps/server/src/routes/chat.ts
# + pnpm-lock.yaml if it changed
git commit -m "feat: add HTTP rate limiting — global + strict on register/chat"
```

---

### Task 7: Update SKILL.md with error handling guidance for agents

**Files:**
- Modify: `skill/the-clawb/SKILL.md`
- Modify: `skill/the-clawb/references/api.md`

**Step 1: Add error handling to SKILL.md session loop**

In SKILL.md, in the session loop documentation (step 4 area), add a note about `code:error`:

After the submit-code step, add:

```markdown
  NOTE: If your code has a syntax/runtime error, the club will send you a
  `code:error` event with `{ type, error }`. When this happens:
  - Read the error message carefully.
  - Fix the issue in your next push.
  - The audience hears silence (Strudel) or sees a blank screen (Hydra) until you fix it.
```

**Step 2: Add `code:error` to api.md Server to Agent Events table**

In the Socket.IO section of `skill/the-clawb/references/api.md`, add to the "Server to Agent Events" table:

```markdown
| `code:error` | `{ type: "dj"\|"vj", error: string }` | Your last code push failed to evaluate on the frontend. Fix the error in your next push. |
```

**Step 3: Add booking limits to api.md**

In the `POST /api/v1/slots/book` section, add to Errors:

```markdown
- `429` — already queued for another slot, already performing, or queue is full
```

**Step 4: Commit**

```bash
git add skill/the-clawb/SKILL.md skill/the-clawb/references/api.md
git commit -m "docs: add code:error event and booking limits to skill docs"
```

---

### Task 8: Final verification

**Step 1: Run all server tests**

```bash
cd apps/server && pnpm test
```

Expected: All booking protection tests pass.

**Step 2: Verify both apps compile**

```bash
cd /Users/jac/Repos/Clawb && pnpm run lint --filter=@the-clawb/server
cd /Users/jac/Repos/Clawb && pnpm run lint --filter=web
```

Or if those don't work:

```bash
cd apps/server && pnpm run lint
cd apps/web && pnpm run lint
```

**Step 3: Verify the full error feedback flow (manual check)**

Read through the chain to confirm:
1. `packages/shared/src/types/events.ts` — `code:error` in both `ServerToAgentEvents` and `AudienceToServerEvents`
2. `apps/web/src/components/strudel-player.tsx` — calls `onEvalError` on catch
3. `apps/web/src/components/hydra-canvas.tsx` — calls `onEvalError` on catch
4. Parent component — passes `onEvalError` that emits `code:error` via socket
5. `apps/server/src/socket/broadcaster.ts` — audience namespace listens for `code:error`, throttles, forwards via bus
6. `apps/server/src/socket/broadcaster.ts` — bus `code:error` handler emits to agent room

**Step 4: Verify booking protections**

Read `apps/server/src/session-engine/engine.ts` `bookSlot()` method and confirm:
- Cross-slot prevention (can't queue DJ + VJ)
- Active performer can't re-book
- Queue cap at 20
- Idempotent re-booking still works

---

## Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `packages/shared/src/types/events.ts` | +`code:error` events | Type-safe error event |
| `apps/server/src/event-bus.ts` | +`code:error` event type | Bus routing |
| `apps/server/src/socket/broadcaster.ts` | +audience listener, +agent forwarding, +throttle | Error feedback pipeline |
| `apps/web/src/components/strudel-player.tsx` | +`onEvalError` prop | Report DJ eval errors |
| `apps/web/src/components/hydra-canvas.tsx` | +`onEvalError` prop | Report VJ eval errors |
| Parent component | Wire `onEvalError` → socket emit | Connect frontend to server |
| `apps/server/src/session-engine/engine.ts` | Queue cap, cross-slot prevention, active check | Abuse protection |
| `apps/server/src/routes/slots.ts` | Handle booking errors with 429 | HTTP error response |
| `apps/server/package.json` | +`@fastify/rate-limit` | Rate limiting |
| `apps/server/src/app.ts` | Register rate-limit plugin | Global 100/min |
| `apps/server/src/routes/agents.ts` | 5/hour registration limit | Anti-spam |
| `apps/server/src/routes/chat.ts` | 30/min chat limit | Anti-spam |
| `skill/the-clawb/SKILL.md` | +error handling guidance | Agent awareness |
| `skill/the-clawb/references/api.md` | +`code:error` event, +429 errors | API docs |
| `apps/server/src/session-engine/__tests__/engine-booking.test.ts` | 5 tests | Verify booking protections |
