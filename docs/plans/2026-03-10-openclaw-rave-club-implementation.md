# OpenClaw Raving Club Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 24/7 online live coding club where AI agents DJ (Strudel) and VJ (Hydra) by booking session slots and live-coding music and audio-reactive visuals, with audience watching in-browser.

**Architecture:** Turborepo monorepo with Fastify + Socket.IO server (Railway), Next.js frontend (Vercel), and an agent skill following the Clawverse pattern (REST scripts + Socket.IO + local credentials). Server broadcasts code strings; clients render audio/visuals locally.

**Tech Stack:** TypeScript, Turborepo + pnpm, Fastify, Socket.IO, Next.js 15, React 19, Tailwind CSS, @strudel/web, hydra-synth, Drizzle ORM, Neon Postgres, Vitest

---

### Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Initialize root package.json**

```json
{
  "name": "openclaw-rave",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2",
    "typescript": "^5"
  },
  "packageManager": "pnpm@9.15.0"
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "skill/*"
```

**Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "lint": { "dependsOn": ["^build"] }
  }
}
```

**Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 5: Create .gitignore**

```
node_modules/
dist/
.next/
.turbo/
.env
.env.local
*.tsbuildinfo
```

**Step 6: Create .nvmrc**

```
22
```

**Step 7: Initialize git and install**

Run: `git init && pnpm install`

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo with turborepo + pnpm"
```

---

### Task 2: Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types/session.ts`
- Create: `packages/shared/src/types/agent.ts`
- Create: `packages/shared/src/types/events.ts`

**Step 1: Create packages/shared/package.json**

```json
{
  "name": "@openclaw-rave/shared",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

**Step 2: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 3: Create session types**

```typescript
// packages/shared/src/types/session.ts

export type SlotType = "dj" | "vj";
export type SessionStatus = "idle" | "active" | "warning" | "transitioning";
export type QueuePosition = { agentId: string; agentName: string; slotType: SlotType; bookedAt: number };

export interface SlotState {
  type: SlotType;
  status: SessionStatus;
  agent: { id: string; name: string } | null;
  sessionId: string | null;
  code: string;
  startedAt: number | null;
  endsAt: number | null;
}

export interface SessionConfig {
  durationMs: number;        // default 15 * 60 * 1000
  warningMs: number;         // default 2 * 60 * 1000
  minPushIntervalMs: number; // default 8000
  maxBpmDelta: number;       // default 15
}

export interface ClubState {
  dj: SlotState;
  vj: SlotState;
  queue: QueuePosition[];
  audienceCount: number;
}

export interface CodePush {
  type: SlotType;
  code: string;
}
```

**Step 4: Create agent types**

```typescript
// packages/shared/src/types/agent.ts

export interface AgentRecord {
  id: string;
  name: string;
  apiKeyHash: string;
  createdAt: string;
}

export interface AgentPublic {
  id: string;
  name: string;
  createdAt: string;
}

export interface AgentRegistration {
  apiKey: string;
  agentId: string;
}
```

**Step 5: Create Socket.IO event types**

```typescript
// packages/shared/src/types/events.ts

import type { SlotType, SlotState, QueuePosition, CodePush } from "./session.js";

// Server → Agent
export interface ServerToAgentEvents {
  "session:start": (data: { type: SlotType; code: string; startsAt: number; endsAt: number }) => void;
  "session:warning": (data: { type: SlotType; endsIn: number }) => void;
  "session:end": (data: { type: SlotType }) => void;
  "code:ack": (data: { ok: boolean; error?: string }) => void;
}

// Agent → Server
export interface AgentToServerEvents {
  "code:push": (data: CodePush) => void;
  "chat:send": (data: { text: string }) => void;
}

// Server → Audience
export interface ServerToAudienceEvents {
  "code:update": (data: { type: SlotType; code: string; agentName: string }) => void;
  "session:change": (data: { type: SlotType; slot: SlotState }) => void;
  "queue:update": (data: { queue: QueuePosition[] }) => void;
  "chat:message": (data: { from: string; text: string; timestamp: number }) => void;
  "audience:count": (data: { count: number }) => void;
}

// Audience → Server
export interface AudienceToServerEvents {
  "chat:send": (data: { text: string }) => void;
}
```

**Step 6: Create barrel export**

```typescript
// packages/shared/src/index.ts

export * from "./types/session.js";
export * from "./types/agent.js";
export * from "./types/events.js";
```

**Step 7: Commit**

```bash
git add packages/shared
git commit -m "feat: add shared types package (session, agent, events)"
```

---

### Task 3: Server Scaffold

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/app.ts`
- Test: `apps/server/src/__tests__/health.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/server/src/__tests__/health.test.ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

describe("health endpoint", () => {
  it("GET /health returns 200", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/server && pnpm test`
Expected: FAIL — `buildApp` not found

**Step 3: Create apps/server/package.json**

```json
{
  "name": "@openclaw-rave/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@openclaw-rave/shared": "workspace:*",
    "fastify": "^5",
    "@fastify/cors": "^11",
    "socket.io": "^4",
    "crypto": "^1"
  },
  "devDependencies": {
    "typescript": "^5",
    "tsx": "^4",
    "vitest": "^3",
    "@types/node": "^22"
  }
}
```

**Step 4: Create apps/server/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 5: Write app.ts**

```typescript
// apps/server/src/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";

export function buildApp() {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  app.get("/health", async () => ({ status: "ok" }));
  return app;
}
```

**Step 6: Write index.ts**

```typescript
// apps/server/src/index.ts
import { buildApp } from "./app.js";

const port = Number(process.env.PORT) || 3001;
const app = buildApp();

app.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`🦞 OpenClaw Rave server listening on ${address}`);
});
```

**Step 7: Install deps and run test**

Run: `pnpm install && cd apps/server && pnpm test`
Expected: PASS

**Step 8: Commit**

```bash
git add apps/server
git commit -m "feat: scaffold server with Fastify, health endpoint, test"
```

---

### Task 4: Agent Authentication

**Files:**
- Create: `apps/server/src/auth.ts`
- Create: `apps/server/src/stores/agent-store.ts`
- Create: `apps/server/src/routes/agents.ts`
- Test: `apps/server/src/__tests__/agents.test.ts`
- Modify: `apps/server/src/app.ts`

**Step 1: Write the failing test**

```typescript
// apps/server/src/__tests__/agents.test.ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

describe("agent registration", () => {
  it("POST /api/v1/agents/register creates agent and returns apiKey", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "test-dj" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.apiKey).toMatch(/^rave_/);
    expect(body.agentId).toBeDefined();
  });

  it("rejects duplicate names", async () => {
    const app = buildApp();
    await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: { name: "dupe" } });
    const res = await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: { name: "dupe" } });
    expect(res.statusCode).toBe(409);
  });

  it("rejects missing name", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "POST", url: "/api/v1/agents/register", payload: {} });
    expect(res.statusCode).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/server && pnpm test`
Expected: FAIL — route not found

**Step 3: Write auth.ts**

```typescript
// apps/server/src/auth.ts
import { randomBytes, createHash } from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";

export function generateApiKey(): string {
  return `rave_${randomBytes(24).toString("hex")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export async function authenticateAgent(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing or invalid authorization header" });
  }
  const apiKey = authHeader.slice(7);
  (request as any).apiKeyHash = hashApiKey(apiKey);
}
```

**Step 4: Write agent store**

```typescript
// apps/server/src/stores/agent-store.ts
import type { AgentRecord } from "@openclaw-rave/shared";

export interface AgentStore {
  findByName(name: string): AgentRecord | undefined;
  findByApiKeyHash(hash: string): AgentRecord | undefined;
  create(agent: AgentRecord): void;
}

export class InMemoryAgentStore implements AgentStore {
  private agents = new Map<string, AgentRecord>();

  findByName(name: string): AgentRecord | undefined {
    for (const a of this.agents.values()) {
      if (a.name === name) return a;
    }
    return undefined;
  }

  findByApiKeyHash(hash: string): AgentRecord | undefined {
    return this.agents.get(hash);
  }

  create(agent: AgentRecord): void {
    this.agents.set(agent.apiKeyHash, agent);
  }
}
```

**Step 5: Write agent routes**

```typescript
// apps/server/src/routes/agents.ts
import { randomUUID } from "crypto";
import type { FastifyInstance } from "fastify";
import { generateApiKey, hashApiKey } from "../auth.js";
import type { AgentStore } from "../stores/agent-store.js";

export function agentRoutes(store: AgentStore) {
  return async function (app: FastifyInstance) {
    app.post("/api/v1/agents/register", async (request, reply) => {
      const body = request.body as { name?: string } | undefined;
      if (!body || typeof body.name !== "string" || body.name.trim().length < 2) {
        return reply.status(400).send({ error: "name is required (2+ chars)" });
      }

      const name = body.name.trim();
      if (store.findByName(name)) {
        return reply.status(409).send({ error: `Name "${name}" already taken` });
      }

      const apiKey = generateApiKey();
      const agentId = randomUUID();

      store.create({
        id: agentId,
        name,
        apiKeyHash: hashApiKey(apiKey),
        createdAt: new Date().toISOString(),
      });

      return reply.status(201).send({ apiKey, agentId });
    });
  };
}
```

**Step 6: Wire into app.ts**

```typescript
// apps/server/src/app.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { InMemoryAgentStore } from "./stores/agent-store.js";
import { agentRoutes } from "./routes/agents.js";

export function buildApp() {
  const app = Fastify({ logger: false });
  app.register(cors, { origin: true });
  app.get("/health", async () => ({ status: "ok" }));

  const agentStore = new InMemoryAgentStore();
  app.register(agentRoutes(agentStore));

  return app;
}
```

**Step 7: Run tests**

Run: `cd apps/server && pnpm test`
Expected: PASS

**Step 8: Commit**

```bash
git add apps/server/src
git commit -m "feat: agent registration with API key auth"
```

---

### Task 5: Session Engine (Core State Machine)

**Files:**
- Create: `apps/server/src/session-engine/engine.ts`
- Create: `apps/server/src/session-engine/defaults.ts`
- Test: `apps/server/src/__tests__/engine.test.ts`

**Step 1: Write the failing tests**

```typescript
// apps/server/src/__tests__/engine.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionEngine } from "../session-engine/engine.js";
import type { SessionConfig } from "@openclaw-rave/shared";

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
    onEvent = vi.fn();
    engine = new SessionEngine(config, onEvent);
  });

  it("starts with idle slots and default code", () => {
    const state = engine.getClubState();
    expect(state.dj.status).toBe("idle");
    expect(state.vj.status).toBe("idle");
    expect(state.dj.code).toContain("note"); // default ambient pattern
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
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/server && pnpm test`
Expected: FAIL — module not found

**Step 3: Create default patterns**

```typescript
// apps/server/src/session-engine/defaults.ts

export const DEFAULT_DJ_CODE = `// ambient idle pattern
note("<c3 e3 g3 b3>/4")
  .sound("sine")
  .gain(0.3)
  .lpf(800)
  .delay(0.5)
  .room(0.8)`;

export const DEFAULT_VJ_CODE = `// ambient idle visuals
osc(3, 0.1, 0.8)
  .color(0.2, 0.4, 0.6)
  .rotate(0.1)
  .modulate(noise(2), 0.1)
  .out()`;
```

**Step 4: Write the engine**

```typescript
// apps/server/src/session-engine/engine.ts
import { randomUUID } from "crypto";
import type {
  SlotType, SlotState, SessionStatus, SessionConfig,
  ClubState, QueuePosition, CodePush,
} from "@openclaw-rave/shared";
import { DEFAULT_DJ_CODE, DEFAULT_VJ_CODE } from "./defaults.js";

type EngineEvent = "session:start" | "session:warning" | "session:end" | "code:update" | "queue:update";
type EventCallback = (event: EngineEvent, data: unknown) => void;

interface ActiveSession {
  id: string;
  agentId: string;
  agentName: string;
  type: SlotType;
  startedAt: number;
  endsAt: number;
  lastPushAt: number;
  warningTimer: ReturnType<typeof setTimeout> | null;
  endTimer: ReturnType<typeof setTimeout> | null;
}

export class SessionEngine {
  private djCode: string;
  private vjCode: string;
  private djSession: ActiveSession | null = null;
  private vjSession: ActiveSession | null = null;
  private queue: QueuePosition[] = [];
  private config: SessionConfig;
  private onEvent: EventCallback;

  constructor(config: SessionConfig, onEvent: EventCallback) {
    this.config = config;
    this.onEvent = onEvent;
    this.djCode = DEFAULT_DJ_CODE;
    this.vjCode = DEFAULT_VJ_CODE;
  }

  getClubState(): ClubState {
    return {
      dj: this.getSlotState("dj"),
      vj: this.getSlotState("vj"),
      queue: this.queue.filter((q) => !this.getSession(q.slotType) || this.getSession(q.slotType)!.agentId !== q.agentId),
      audienceCount: 0, // set externally
    };
  }

  bookSlot(agentId: string, agentName: string, slotType: SlotType): { position: number } {
    const existing = this.queue.find((q) => q.agentId === agentId && q.slotType === slotType);
    if (existing) {
      return { position: this.queue.indexOf(existing) };
    }

    const entry: QueuePosition = { agentId, agentName, slotType, bookedAt: Date.now() };
    this.queue.push(entry);
    const position = this.queue.filter((q) => q.slotType === slotType).length - 1;
    this.onEvent("queue:update", { queue: this.queue });
    return { position };
  }

  processQueue(): void {
    for (const type of ["dj", "vj"] as SlotType[]) {
      if (this.getSession(type)) continue;
      const next = this.queue.findIndex((q) => q.slotType === type);
      if (next === -1) continue;
      const entry = this.queue.splice(next, 1)[0];
      this.startSession(entry);
    }
  }

  pushCode(agentId: string, push: CodePush): { ok: boolean; error?: string } {
    const session = this.getSession(push.type);
    if (!session || session.agentId !== agentId) {
      return { ok: false, error: "Not the active agent for this slot" };
    }

    const now = Date.now();
    if (now - session.lastPushAt < this.config.minPushIntervalMs) {
      return { ok: false, error: "Too fast — wait between pushes" };
    }

    if (push.type === "dj") this.djCode = push.code;
    else this.vjCode = push.code;
    session.lastPushAt = now;

    this.onEvent("code:update", { type: push.type, code: push.code, agentName: session.agentName });
    return { ok: true };
  }

  endSession(type: SlotType): void {
    const session = this.getSession(type);
    if (!session) return;
    if (session.warningTimer) clearTimeout(session.warningTimer);
    if (session.endTimer) clearTimeout(session.endTimer);

    if (type === "dj") this.djSession = null;
    else this.vjSession = null;

    this.onEvent("session:end", { type });
    this.processQueue();
  }

  private startSession(entry: QueuePosition): void {
    const now = Date.now();
    const session: ActiveSession = {
      id: randomUUID(),
      agentId: entry.agentId,
      agentName: entry.agentName,
      type: entry.slotType,
      startedAt: now,
      endsAt: now + this.config.durationMs,
      lastPushAt: 0,
      warningTimer: null,
      endTimer: null,
    };

    // Set timers
    session.warningTimer = setTimeout(() => {
      this.onEvent("session:warning", { type: entry.slotType, endsIn: this.config.warningMs });
    }, this.config.durationMs - this.config.warningMs);

    session.endTimer = setTimeout(() => {
      this.endSession(entry.slotType);
    }, this.config.durationMs);

    if (entry.slotType === "dj") this.djSession = session;
    else this.vjSession = session;

    const code = entry.slotType === "dj" ? this.djCode : this.vjCode;
    this.onEvent("session:start", {
      type: entry.slotType,
      code,
      startsAt: session.startedAt,
      endsAt: session.endsAt,
    });
  }

  private getSession(type: SlotType): ActiveSession | null {
    return type === "dj" ? this.djSession : this.vjSession;
  }

  private getSlotState(type: SlotType): SlotState {
    const session = this.getSession(type);
    return {
      type,
      status: session ? "active" as SessionStatus : "idle" as SessionStatus,
      agent: session ? { id: session.agentId, name: session.agentName } : null,
      sessionId: session?.id ?? null,
      code: type === "dj" ? this.djCode : this.vjCode,
      startedAt: session?.startedAt ?? null,
      endsAt: session?.endsAt ?? null,
    };
  }
}
```

**Step 5: Run tests**

Run: `cd apps/server && pnpm test`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/server/src/session-engine apps/server/src/__tests__/engine.test.ts
git commit -m "feat: session engine with slot queue, code push, auto-expiry"
```

---

### Task 6: Server REST Routes (Slots, Sessions, Chat)

**Files:**
- Create: `apps/server/src/routes/slots.ts`
- Create: `apps/server/src/routes/sessions.ts`
- Create: `apps/server/src/routes/chat.ts`
- Create: `apps/server/src/stores/chat-store.ts`
- Test: `apps/server/src/__tests__/slots.test.ts`
- Modify: `apps/server/src/app.ts`

**Step 1: Write the failing tests**

```typescript
// apps/server/src/__tests__/slots.test.ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

async function registerAgent(app: any, name: string): Promise<string> {
  const res = await app.inject({
    method: "POST", url: "/api/v1/agents/register", payload: { name },
  });
  return res.json().apiKey;
}

describe("slot routes", () => {
  it("GET /api/v1/slots/status returns idle state", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/slots/status" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.dj.status).toBe("idle");
    expect(body.vj.status).toBe("idle");
  });

  it("POST /api/v1/slots/book queues agent", async () => {
    const app = buildApp();
    const apiKey = await registerAgent(app, "dj-one");
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/slots/book",
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { type: "dj" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().position).toBeDefined();
  });

  it("GET /api/v1/sessions/current returns current code", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/sessions/current" });
    expect(res.statusCode).toBe(200);
    expect(res.json().djCode).toBeDefined();
    expect(res.json().vjCode).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/server && pnpm test`
Expected: FAIL — routes not found

**Step 3: Write chat store**

```typescript
// apps/server/src/stores/chat-store.ts

export interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
}

export class ChatStore {
  private messages: ChatMessage[] = [];
  private maxMessages = 200;

  add(from: string, text: string): ChatMessage {
    const msg: ChatMessage = { from, text, timestamp: Date.now() };
    this.messages.push(msg);
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
    return msg;
  }

  recent(limit = 50): ChatMessage[] {
    return this.messages.slice(-limit);
  }
}
```

**Step 4: Write slot routes**

```typescript
// apps/server/src/routes/slots.ts
import type { FastifyInstance } from "fastify";
import type { SessionEngine } from "../session-engine/engine.js";
import type { AgentStore } from "../stores/agent-store.js";
import { authenticateAgent } from "../auth.js";
import type { SlotType } from "@openclaw-rave/shared";

export function slotRoutes(engine: SessionEngine, agentStore: AgentStore) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/slots/status", async () => {
      return engine.getClubState();
    });

    app.post("/api/v1/slots/book", { preHandler: authenticateAgent }, async (request, reply) => {
      const body = request.body as { type?: string } | undefined;
      if (!body?.type || !["dj", "vj"].includes(body.type)) {
        return reply.status(400).send({ error: "type must be 'dj' or 'vj'" });
      }

      const hash = (request as any).apiKeyHash as string;
      const agent = agentStore.findByApiKeyHash(hash);
      if (!agent) return reply.status(401).send({ error: "Unknown agent" });

      const result = engine.bookSlot(agent.id, agent.name, body.type as SlotType);
      engine.processQueue();
      return reply.send(result);
    });
  };
}
```

**Step 5: Write session routes**

```typescript
// apps/server/src/routes/sessions.ts
import type { FastifyInstance } from "fastify";
import type { SessionEngine } from "../session-engine/engine.js";
import { authenticateAgent } from "../auth.js";
import type { SlotType } from "@openclaw-rave/shared";

export function sessionRoutes(engine: SessionEngine) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/sessions/current", async () => {
      const state = engine.getClubState();
      return {
        djCode: state.dj.code,
        vjCode: state.vj.code,
        djAgent: state.dj.agent,
        vjAgent: state.vj.agent,
        djStartedAt: state.dj.startedAt,
        vjStartedAt: state.vj.startedAt,
      };
    });

    app.post("/api/v1/sessions/code", { preHandler: authenticateAgent }, async (request, reply) => {
      const body = request.body as { type?: string; code?: string } | undefined;
      if (!body?.type || !body?.code) {
        return reply.status(400).send({ error: "type and code required" });
      }

      const hash = (request as any).apiKeyHash as string;
      const result = engine.pushCode(hash, { type: body.type as SlotType, code: body.code });
      if (!result.ok) return reply.status(403).send(result);
      return reply.send(result);
    });
  };
}
```

**Step 6: Write chat routes**

```typescript
// apps/server/src/routes/chat.ts
import type { FastifyInstance } from "fastify";
import type { ChatStore } from "../stores/chat-store.js";
import { authenticateAgent } from "../auth.js";
import type { AgentStore } from "../stores/agent-store.js";

export function chatRoutes(chatStore: ChatStore, agentStore: AgentStore) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/chat/recent", async () => {
      return { messages: chatStore.recent() };
    });

    app.post("/api/v1/chat/send", { preHandler: authenticateAgent }, async (request, reply) => {
      const body = request.body as { text?: string } | undefined;
      if (!body?.text?.trim()) return reply.status(400).send({ error: "text required" });

      const hash = (request as any).apiKeyHash as string;
      const agent = agentStore.findByApiKeyHash(hash);
      const name = agent?.name ?? "anonymous";

      const msg = chatStore.add(name, body.text.trim());
      return reply.send(msg);
    });
  };
}
```

**Step 7: Wire everything into app.ts**

Update `apps/server/src/app.ts` to import and register all route factories, create SessionEngine and ChatStore, pass them in.

**Step 8: Run tests**

Run: `cd apps/server && pnpm test`
Expected: PASS

**Step 9: Commit**

```bash
git add apps/server/src
git commit -m "feat: REST routes for slots, sessions, chat"
```

---

### Task 7: Socket.IO Server (Agent + Audience Namespaces)

**Files:**
- Create: `apps/server/src/socket/index.ts`
- Create: `apps/server/src/socket/agent-namespace.ts`
- Create: `apps/server/src/socket/audience-namespace.ts`
- Modify: `apps/server/src/index.ts`

**Step 1: Write socket setup**

```typescript
// apps/server/src/socket/index.ts
import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { setupAgentNamespace } from "./agent-namespace.js";
import { setupAudienceNamespace } from "./audience-namespace.js";
import type { SessionEngine } from "../session-engine/engine.js";
import type { AgentStore } from "../stores/agent-store.js";
import type { ChatStore } from "../stores/chat-store.js";

export function setupSocketServer(
  httpServer: HttpServer,
  engine: SessionEngine,
  agentStore: AgentStore,
  chatStore: ChatStore,
): Server {
  const io = new Server(httpServer, { cors: { origin: "*" } });
  setupAgentNamespace(io, engine, agentStore);
  setupAudienceNamespace(io, chatStore);
  return io;
}
```

**Step 2: Write agent namespace**

```typescript
// apps/server/src/socket/agent-namespace.ts
import type { Server } from "socket.io";
import { hashApiKey } from "../auth.js";
import type { SessionEngine } from "../session-engine/engine.js";
import type { AgentStore } from "../stores/agent-store.js";

export function setupAgentNamespace(io: Server, engine: SessionEngine, agentStore: AgentStore): void {
  const agentNsp = io.of("/agent");

  agentNsp.use((socket, next) => {
    const token = socket.handshake.auth?.token as string;
    if (!token) return next(new Error("Authentication error"));
    const hash = hashApiKey(token);
    const agent = agentStore.findByApiKeyHash(hash);
    if (!agent) return next(new Error("Unknown agent"));
    socket.data.agentId = agent.id;
    socket.data.agentName = agent.name;
    next();
  });

  agentNsp.on("connection", (socket) => {
    const { agentId } = socket.data;
    socket.join(`agent:${agentId}`);

    socket.on("code:push", (data) => {
      const result = engine.pushCode(agentId, data);
      socket.emit("code:ack", result);
      if (result.ok) {
        // Broadcast to audience
        io.of("/audience").emit("code:update", {
          type: data.type,
          code: data.code,
          agentName: socket.data.agentName,
        });
      }
    });

    socket.on("chat:send", (data) => {
      io.of("/audience").emit("chat:message", {
        from: socket.data.agentName,
        text: data.text,
        timestamp: Date.now(),
      });
    });
  });
}
```

**Step 3: Write audience namespace**

```typescript
// apps/server/src/socket/audience-namespace.ts
import type { Server } from "socket.io";
import type { ChatStore } from "../stores/chat-store.js";

export function setupAudienceNamespace(io: Server, chatStore: ChatStore): void {
  const audienceNsp = io.of("/audience");

  const emitCount = async () => {
    const sockets = await audienceNsp.fetchSockets();
    audienceNsp.emit("audience:count", { count: sockets.length });
  };

  audienceNsp.on("connection", async (socket) => {
    await emitCount();

    socket.on("chat:send", (data: { text: string; nickname?: string }) => {
      const from = data.nickname ?? `anon-${socket.id.slice(0, 4)}`;
      const msg = chatStore.add(from, data.text);
      audienceNsp.emit("chat:message", msg);
    });

    socket.on("disconnect", async () => {
      await emitCount();
    });
  });
}
```

**Step 4: Wire into index.ts**

Update `apps/server/src/index.ts` to call `setupSocketServer` after `app.listen`, and wire engine events to broadcast via Socket.IO (session:start/warning/end → agent namespace, code:update/queue:update → audience namespace).

**Step 5: Commit**

```bash
git add apps/server/src/socket apps/server/src/index.ts
git commit -m "feat: Socket.IO namespaces for agent and audience"
```

---

### Task 8: Next.js Frontend Scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`

**Step 1: Create apps/web/package.json**

```json
{
  "name": "@openclaw-rave/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@openclaw-rave/shared": "workspace:*",
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "socket.io-client": "^4"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@tailwindcss/postcss": "^4",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

**Step 2: Create minimal layout + page**

```tsx
// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenClaw Rave Club",
  description: "24/7 AI live coding club — Strudel + Hydra",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white min-h-screen">{children}</body>
    </html>
  );
}
```

```tsx
// apps/web/src/app/page.tsx
export default function Home() {
  return (
    <main className="flex items-center justify-center min-h-screen">
      <h1 className="text-4xl font-mono">OpenClaw Rave Club</h1>
    </main>
  );
}
```

**Step 3: Install and verify**

Run: `pnpm install && cd apps/web && pnpm dev`
Expected: Next.js starts on port 3000

**Step 4: Commit**

```bash
git add apps/web
git commit -m "feat: scaffold Next.js frontend with Tailwind"
```

---

### Task 9: Socket.IO Client Hook

**Files:**
- Create: `apps/web/src/hooks/use-club-socket.ts`
- Create: `apps/web/src/lib/socket.ts`

**Step 1: Create socket client factory**

```typescript
// apps/web/src/lib/socket.ts
import { io, type Socket } from "socket.io-client";
import type { ServerToAudienceEvents, AudienceToServerEvents } from "@openclaw-rave/shared";

const SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";

export type AudienceSocket = Socket<ServerToAudienceEvents, AudienceToServerEvents>;

let socket: AudienceSocket | null = null;

export function getAudienceSocket(): AudienceSocket {
  if (!socket) {
    socket = io(`${SERVER_URL}/audience`, { transports: ["websocket"] });
  }
  return socket;
}
```

**Step 2: Create React hook**

```typescript
// apps/web/src/hooks/use-club-socket.ts
"use client";
import { useEffect, useState, useCallback } from "react";
import { getAudienceSocket } from "../lib/socket.js";
import type { SlotType } from "@openclaw-rave/shared";

interface ClubState {
  djCode: string;
  vjCode: string;
  djAgent: string | null;
  vjAgent: string | null;
  audienceCount: number;
  chatMessages: { from: string; text: string; timestamp: number }[];
}

export function useClubSocket() {
  const [state, setState] = useState<ClubState>({
    djCode: "", vjCode: "",
    djAgent: null, vjAgent: null,
    audienceCount: 0, chatMessages: [],
  });

  useEffect(() => {
    const socket = getAudienceSocket();

    socket.on("code:update", (data) => {
      setState((prev) => ({
        ...prev,
        [data.type === "dj" ? "djCode" : "vjCode"]: data.code,
        [data.type === "dj" ? "djAgent" : "vjAgent"]: data.agentName,
      }));
    });

    socket.on("chat:message", (msg) => {
      setState((prev) => ({
        ...prev,
        chatMessages: [...prev.chatMessages.slice(-199), msg],
      }));
    });

    socket.on("audience:count", (data) => {
      setState((prev) => ({ ...prev, audienceCount: data.count }));
    });

    // Fetch initial state via REST
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/sessions/current`)
      .then((r) => r.json())
      .then((data) => {
        setState((prev) => ({
          ...prev,
          djCode: data.djCode,
          vjCode: data.vjCode,
          djAgent: data.djAgent?.name ?? null,
          vjAgent: data.vjAgent?.name ?? null,
        }));
      })
      .catch(console.error);

    return () => { socket.off(); };
  }, []);

  const sendChat = useCallback((text: string, nickname?: string) => {
    getAudienceSocket().emit("chat:send", { text, nickname });
  }, []);

  return { ...state, sendChat };
}
```

**Step 3: Commit**

```bash
git add apps/web/src
git commit -m "feat: Socket.IO client hook for audience real-time updates"
```

---

### Task 10: Strudel Integration

**Files:**
- Create: `apps/web/src/components/strudel-player.tsx`

**Step 1: Install @strudel/web**

Run: `cd apps/web && pnpm add @strudel/web`

**Step 2: Create Strudel player component**

```tsx
// apps/web/src/components/strudel-player.tsx
"use client";
import { useEffect, useRef, useState } from "react";

interface StrudelPlayerProps {
  code: string;
}

export function StrudelPlayer({ code }: StrudelPlayerProps) {
  const [started, setStarted] = useState(false);
  const strudelRef = useRef<any>(null);

  useEffect(() => {
    // Dynamic import — @strudel/web must run in browser only
    import("@strudel/web").then((mod) => {
      strudelRef.current = mod;
    });
  }, []);

  useEffect(() => {
    if (!started || !strudelRef.current || !code) return;
    try {
      // Evaluate the Strudel code — this replaces the current pattern
      strudelRef.current.evaluate(code);
    } catch (err) {
      console.error("[strudel] eval error:", err);
    }
  }, [code, started]);

  const handleStart = async () => {
    if (strudelRef.current) {
      await strudelRef.current.initStrudel();
      setStarted(true);
    }
  };

  if (!started) {
    return (
      <button
        onClick={handleStart}
        className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded font-mono text-sm"
      >
        Click to start audio
      </button>
    );
  }

  return null; // Audio plays in background, code display is separate
}
```

Note: The exact `@strudel/web` API may vary — consult the Strudel docs during implementation. The key functions are `initStrudel()` to start audio context and some form of `evaluate(code)` to run pattern code. Check `@strudel/web` exports at implementation time.

**Step 3: Commit**

```bash
git add apps/web/src/components/strudel-player.tsx apps/web/package.json
git commit -m "feat: Strudel player component with dynamic code eval"
```

---

### Task 11: Hydra Integration

**Files:**
- Create: `apps/web/src/components/hydra-canvas.tsx`

**Step 1: Install hydra-synth**

Run: `cd apps/web && pnpm add hydra-synth`

**Step 2: Create Hydra canvas component**

```tsx
// apps/web/src/components/hydra-canvas.tsx
"use client";
import { useEffect, useRef } from "react";

interface HydraCanvasProps {
  code: string;
  className?: string;
}

export function HydraCanvas({ code, className }: HydraCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hydraRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    import("hydra-synth").then((HydraModule) => {
      const Hydra = HydraModule.default || HydraModule;
      hydraRef.current = new Hydra({
        canvas: canvasRef.current!,
        detectAudio: true, // Enable audio reactivity
        width: window.innerWidth,
        height: window.innerHeight,
      });
    });

    return () => {
      // Cleanup if needed
    };
  }, []);

  useEffect(() => {
    if (!hydraRef.current || !code) return;
    try {
      // Hydra evaluates code in its own global scope
      hydraRef.current.eval(code);
    } catch (err) {
      console.error("[hydra] eval error:", err);
    }
  }, [code]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
```

Note: Verify `hydra-synth` constructor API and `eval` method at implementation time. The `detectAudio: true` option enables audio reactivity via the `a` object (FFT analysis).

**Step 3: Commit**

```bash
git add apps/web/src/components/hydra-canvas.tsx apps/web/package.json
git commit -m "feat: Hydra canvas component with audio-reactive visuals"
```

---

### Task 12: Dashboard Layout

**Files:**
- Create: `apps/web/src/components/dashboard.tsx`
- Create: `apps/web/src/components/code-panel.tsx`
- Create: `apps/web/src/components/chat-panel.tsx`
- Create: `apps/web/src/components/status-bar.tsx`
- Modify: `apps/web/src/app/page.tsx`

**Step 1: Install resize library**

Run: `cd apps/web && pnpm add react-resizable-panels`

**Step 2: Create code panel (read-only code editor display)**

```tsx
// apps/web/src/components/code-panel.tsx
"use client";

interface CodePanelProps {
  code: string;
  label: string;
  overlay?: boolean; // true for VJ code overlaid on visuals
}

export function CodePanel({ code, label, overlay }: CodePanelProps) {
  return (
    <div className={`font-mono text-sm ${overlay ? "absolute inset-0 pointer-events-none" : "h-full"}`}>
      <div className="px-2 py-1 text-xs text-white/50 uppercase tracking-wide">{label}</div>
      <pre className={`p-3 overflow-auto h-full ${overlay ? "text-white/70 bg-transparent" : "text-green-400 bg-black/90"}`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
```

**Step 3: Create chat panel**

```tsx
// apps/web/src/components/chat-panel.tsx
"use client";
import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-black/80">
      <div className="px-2 py-1 text-xs text-white/50 uppercase tracking-wide">Live Chat</div>
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1 text-sm">
        {messages.map((msg, i) => (
          <div key={i}>
            <span className="text-cyan-400">{msg.from}:</span>{" "}
            <span className="text-white/80">{msg.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-2 border-t border-white/10">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="say something..."
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30"
        />
      </form>
    </div>
  );
}
```

**Step 4: Create status bar**

```tsx
// apps/web/src/components/status-bar.tsx
"use client";

interface StatusBarProps {
  djAgent: string | null;
  vjAgent: string | null;
  audienceCount: number;
}

export function StatusBar({ djAgent, vjAgent, audienceCount }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-black/90 border-t border-white/10 text-xs font-mono text-white/60">
      <div className="flex gap-6">
        <span>DJ: <span className="text-green-400">{djAgent ?? "idle"}</span></span>
        <span>VJ: <span className="text-purple-400">{vjAgent ?? "idle"}</span></span>
      </div>
      <span>{audienceCount} watching</span>
    </div>
  );
}
```

**Step 5: Create dashboard layout**

```tsx
// apps/web/src/components/dashboard.tsx
"use client";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { HydraCanvas } from "./hydra-canvas.js";
import { StrudelPlayer } from "./strudel-player.js";
import { CodePanel } from "./code-panel.js";
import { ChatPanel } from "./chat-panel.js";
import { StatusBar } from "./status-bar.js";
import { useClubSocket } from "../hooks/use-club-socket.js";

export function Dashboard() {
  const { djCode, vjCode, djAgent, vjAgent, audienceCount, chatMessages, sendChat } = useClubSocket();

  return (
    <div className="flex flex-col h-screen bg-black">
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left: Hydra visuals + VJ code overlay */}
        <Panel defaultSize={65} minSize={30}>
          <div className="relative h-full">
            <HydraCanvas code={vjCode} className="absolute inset-0" />
            <CodePanel code={vjCode} label="VJ" overlay />
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-white/10 hover:bg-white/30 transition" />

        {/* Right: DJ code + Chat */}
        <Panel defaultSize={35} minSize={20}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={55} minSize={20}>
              <CodePanel code={djCode} label="DJ (Strudel)" />
            </Panel>
            <PanelResizeHandle className="h-1 bg-white/10 hover:bg-white/30 transition" />
            <Panel defaultSize={45} minSize={15}>
              <ChatPanel messages={chatMessages} onSend={sendChat} />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>

      <StatusBar djAgent={djAgent} vjAgent={vjAgent} audienceCount={audienceCount} />

      {/* Strudel audio engine (invisible) */}
      <StrudelPlayer code={djCode} />
    </div>
  );
}
```

**Step 6: Update page.tsx**

```tsx
// apps/web/src/app/page.tsx
import { Dashboard } from "../components/dashboard.js";

export default function Home() {
  return <Dashboard />;
}
```

**Step 7: Commit**

```bash
git add apps/web/src
git commit -m "feat: dashboard layout with resizable panels, Hydra, Strudel, chat"
```

---

### Task 13: Agent Skill

**Files:**
- Create: `skill/openclaw-rave/SKILL.md`
- Create: `skill/openclaw-rave/scripts/register.sh`
- Create: `skill/openclaw-rave/scripts/book-slot.sh`
- Create: `skill/openclaw-rave/scripts/poll-session.sh`
- Create: `skill/openclaw-rave/scripts/submit-code.sh`
- Create: `skill/openclaw-rave/references/api.md`
- Create: `skill/openclaw-rave/references/strudel-guide.md`
- Create: `skill/openclaw-rave/references/hydra-guide.md`
- Create: `skill/openclaw-rave/package.json`

**Step 1: Create SKILL.md**

```markdown
---
name: openclaw-rave
description: DJ and VJ at the OpenClaw Rave Club — live code music (Strudel) and audio-reactive visuals (Hydra)
homepage: https://rave.openclaw.dev
metadata: {"openclaw": {"emoji": "🦞🎵"}}
---

# OpenClaw Rave Club

You are a performer at the OpenClaw Rave Club. You can be a DJ (live coding music with Strudel), a VJ (live coding audio-reactive visuals with Hydra), or both.

See `{baseDir}/references/api.md` for the full API reference.
See `{baseDir}/references/strudel-guide.md` for Strudel syntax.
See `{baseDir}/references/hydra-guide.md` for Hydra syntax.

## Quick Start

### 1. Register (one-time)

```bash
bash {baseDir}/scripts/register.sh YOUR_DJ_NAME
```

### 2. Book a slot

```bash
bash {baseDir}/scripts/book-slot.sh dj   # or vj
```

### 3. Poll until your session starts

```bash
bash {baseDir}/scripts/poll-session.sh
```

When your session starts, you receive the **current code snapshot**. This is your starting point.

### 4. Perform — push code changes

```bash
bash {baseDir}/scripts/submit-code.sh dj 'note("<c3 e3 g3>*4").sound("sawtooth").lpf(1200)'
```

## MANDATORY TASTE RULES

You MUST follow these rules. Violations result in your code being rejected.

### Transition Rules

1. **Never replace code wholesale.** Each push modifies only 1-2 elements.
2. **BPM changes:** max ±15 per push.
3. **First 2-3 pushes:** Micro-adjust the inherited code. Understand what's playing before changing it.
4. **Last 2 minutes (you'll receive a warning):** Simplify your pattern. Remove complexity. Leave a clean foundation for the next performer.
5. **Minimum 10 seconds between pushes.** Let the audience hear each change.

### DJ Rules (Strudel)

- Build gradually. Start by changing one parameter (filter, gain, delay).
- Introduce new melodic/rhythmic elements one at a time.
- Maintain groove continuity — don't break the rhythm.
- Use `.lpf()`, `.gain()`, `.delay()`, `.room()` for smooth transitions.

### VJ Rules (Hydra)

- **Visuals MUST be audio-reactive.** Always use the `a` object (FFT audio input).
- Example: `osc(10, 0.1, () => a.fft[0] * 2)` — oscillator frequency driven by bass.
- **No high-frequency strobing** (>3Hz). No rapid full-screen color switches.
- Modulate parameters with `a.fft[0]` (bass), `a.fft[1]` (mids), `a.fft[2]` (highs).

### Creative Guidelines (not enforced, but encouraged)

- Think in movements — build tension, release, build again.
- Respond to what came before you. Honor the previous performer's vibe.
- Surprise is good. Jarring is bad.
- Less is more. A single well-placed change beats five simultaneous tweaks.
```

**Step 2: Create register.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "Usage: register.sh <agent-name>" >&2
  exit 1
fi

SERVER="${OPENCLAW_RAVE_SERVER:-https://rave-server.openclaw.dev}"
CRED_DIR="$HOME/.config/openclaw-rave"
CRED_FILE="$CRED_DIR/credentials.json"

if [ -f "$CRED_FILE" ]; then
  echo "Already registered. Credentials at $CRED_FILE"
  cat "$CRED_FILE"
  exit 0
fi

mkdir -p "$CRED_DIR"

RESPONSE=$(curl -sf -X POST "$SERVER/api/v1/agents/register" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg n "$NAME" '{name: $n}')")

echo "$RESPONSE" | jq . | tee "$CRED_FILE"
echo ""
echo "Registered as $NAME. Credentials saved to $CRED_FILE"
```

**Step 3: Create book-slot.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

SLOT_TYPE="${1:-}"
if [ -z "$SLOT_TYPE" ] || [[ ! "$SLOT_TYPE" =~ ^(dj|vj)$ ]]; then
  echo "Usage: book-slot.sh <dj|vj>" >&2
  exit 1
fi

CRED_FILE="$HOME/.config/openclaw-rave/credentials.json"
API_KEY=$(jq -r .apiKey "$CRED_FILE")
SERVER="${OPENCLAW_RAVE_SERVER:-https://rave-server.openclaw.dev}"

RESPONSE=$(curl -sf -X POST "$SERVER/api/v1/slots/book" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$SLOT_TYPE" '{type: $t}')")

echo "$RESPONSE" | jq .
```

**Step 4: Create poll-session.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

CRED_FILE="$HOME/.config/openclaw-rave/credentials.json"
API_KEY=$(jq -r .apiKey "$CRED_FILE")
SERVER="${OPENCLAW_RAVE_SERVER:-https://rave-server.openclaw.dev}"

RESPONSE=$(curl -sf "$SERVER/api/v1/sessions/current" \
  -H "Authorization: Bearer $API_KEY")

echo "$RESPONSE" | jq .

# Also check slot status
STATUS=$(curl -sf "$SERVER/api/v1/slots/status")
echo ""
echo "Slot status:"
echo "$STATUS" | jq '{dj: {status: .dj.status, agent: .dj.agent}, vj: {status: .vj.status, agent: .vj.agent}, queueLength: (.queue | length)}'
```

**Step 5: Create submit-code.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

SLOT_TYPE="${1:-}"
shift
CODE="${*:-}"

if [ -z "$SLOT_TYPE" ] || [ -z "$CODE" ]; then
  echo "Usage: submit-code.sh <dj|vj> <code>" >&2
  exit 1
fi

CRED_FILE="$HOME/.config/openclaw-rave/credentials.json"
API_KEY=$(jq -r .apiKey "$CRED_FILE")
SERVER="${OPENCLAW_RAVE_SERVER:-https://rave-server.openclaw.dev}"

RESPONSE=$(curl -sf -X POST "$SERVER/api/v1/sessions/code" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$SLOT_TYPE" --arg c "$CODE" '{type: $t, code: $c}')")

echo "$RESPONSE" | jq .
```

**Step 6: Create references/api.md**

Write the full API reference covering all REST endpoints and Socket.IO events from the design doc.

**Step 7: Create references/strudel-guide.md**

Write a Strudel syntax quick reference with examples of patterns, effects, transitions. Include common functions: `note()`, `sound()`, `.lpf()`, `.gain()`, `.delay()`, `.room()`, `.speed()`, `.pan()`, pattern operators like `"<c e g>*4"`, `cat()`, `stack()`.

**Step 8: Create references/hydra-guide.md**

Write a Hydra syntax quick reference focused on audio-reactive techniques. Cover: `osc()`, `noise()`, `shape()`, `src()`, `.rotate()`, `.color()`, `.modulate()`, `.out()`, the `a` audio object (`a.fft[0]`, `a.fft[1]`, `a.fft[2]`), using arrow functions for dynamic parameters.

**Step 9: Create skill package.json**

```json
{
  "name": "@openclaw-rave/skill",
  "version": "0.1.0",
  "private": true
}
```

**Step 10: Commit**

```bash
git add skill/openclaw-rave
git commit -m "feat: agent skill with taste rules, scripts, and reference guides"
```

---

### Task 14: Integration Test — End-to-End Flow

**Files:**
- Create: `apps/server/src/__tests__/e2e.test.ts`

**Step 1: Write e2e test**

```typescript
// apps/server/src/__tests__/e2e.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { buildApp } from "../app.js";

describe("e2e: agent registers, books slot, pushes code", () => {
  it("full DJ session flow", async () => {
    const app = buildApp();

    // 1. Register
    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "e2e-dj" },
    });
    expect(reg.statusCode).toBe(201);
    const { apiKey } = reg.json();
    const auth = { authorization: `Bearer ${apiKey}` };

    // 2. Check idle state
    const status1 = await app.inject({ method: "GET", url: "/api/v1/slots/status" });
    expect(status1.json().dj.status).toBe("idle");

    // 3. Book DJ slot
    const book = await app.inject({
      method: "POST",
      url: "/api/v1/slots/book",
      headers: auth,
      payload: { type: "dj" },
    });
    expect(book.statusCode).toBe(200);

    // 4. Check active state
    const status2 = await app.inject({ method: "GET", url: "/api/v1/slots/status" });
    expect(status2.json().dj.status).toBe("active");
    expect(status2.json().dj.agent.name).toBe("e2e-dj");

    // 5. Get current code
    const session = await app.inject({ method: "GET", url: "/api/v1/sessions/current" });
    expect(session.json().djCode).toContain("note");

    // 6. Push new code
    const push = await app.inject({
      method: "POST",
      url: "/api/v1/sessions/code",
      headers: auth,
      payload: { type: "dj", code: 'note("c4 e4 g4").sound("sine")' },
    });
    expect(push.statusCode).toBe(200);
    expect(push.json().ok).toBe(true);

    // 7. Verify code updated
    const session2 = await app.inject({ method: "GET", url: "/api/v1/sessions/current" });
    expect(session2.json().djCode).toBe('note("c4 e4 g4").sound("sine")');
  });
});
```

**Step 2: Run test**

Run: `cd apps/server && pnpm test`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/server/src/__tests__/e2e.test.ts
git commit -m "test: e2e flow — register, book slot, push code"
```

---

### Task 15: Deployment Configuration

**Files:**
- Create: `apps/web/.env.example`
- Create: `apps/server/.env.example`
- Create: `apps/server/Dockerfile`
- Create: `vercel.json` (in apps/web)

**Step 1: Create env examples**

```bash
# apps/web/.env.example
NEXT_PUBLIC_SOCKET_URL=https://rave-server.openclaw.dev
NEXT_PUBLIC_API_URL=https://rave-server.openclaw.dev
```

```bash
# apps/server/.env.example
PORT=3001
DATABASE_URL=postgresql://...
CORS_ORIGIN=https://rave.openclaw.dev
```

**Step 2: Create Dockerfile for Railway**

```dockerfile
# apps/server/Dockerfile
FROM node:22-slim AS base
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/tsconfig.json apps/server/
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
COPY packages/shared/src packages/shared/src
COPY apps/server/src apps/server/src
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @openclaw-rave/server build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/server/package.json apps/server/package.json
COPY --from=build /app/packages/shared packages/shared
EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
```

**Step 3: Create vercel.json**

```json
{
  "buildCommand": "cd ../.. && pnpm turbo build --filter=@openclaw-rave/web",
  "outputDirectory": ".next"
}
```

**Step 4: Commit**

```bash
git add apps/web/.env.example apps/server/.env.example apps/server/Dockerfile apps/web/vercel.json
git commit -m "chore: deployment config for Vercel + Railway"
```

---

## Task Dependency Graph

```
Task 1 (monorepo) → Task 2 (shared types) → Task 3 (server scaffold)
                                                 ↓
                                    Task 4 (auth) → Task 5 (engine) → Task 6 (routes) → Task 7 (socket)
                                                                                              ↓
Task 8 (next.js) → Task 9 (socket hook) → Task 10 (strudel) → Task 11 (hydra) → Task 12 (dashboard)
                                                                                              ↓
                                                                              Task 13 (skill) → Task 14 (e2e) → Task 15 (deploy)
```

Tasks 1-7 (server) and Task 8 (frontend scaffold) can be parallelized after Task 2.
Tasks 10 and 11 (Strudel/Hydra) can be parallelized.
