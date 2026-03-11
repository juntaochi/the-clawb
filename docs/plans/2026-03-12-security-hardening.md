# Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 8 security vulnerabilities found in the security review — auth bypass, input validation, CORS, chat spoofing, open registration, and code sandboxing.

**Architecture:** Server-side fixes first (auth, validation, CORS, registration gate), then chat protocol improvements, then frontend sandbox isolation. Each task is independently testable. All validation uses simple inline checks — no new dependencies.

**Tech Stack:** Fastify 5, Socket.IO 4, Vitest, TypeScript

---

### Task 1: Fix Auth PreHandler — Verify API Key Hash Against Store

The `authenticateAgent` preHandler only checks header format, never verifies the key exists. The chat endpoint falls through to `"anonymous"` for invalid keys.

**Files:**
- Modify: `apps/server/src/auth.ts:12-19`
- Modify: `apps/server/src/routes/chat.ts:16-18`
- Modify: `apps/server/src/routes/slots.ts:19-21`
- Modify: `apps/server/src/routes/sessions.ts:28-29`
- Modify: `apps/server/src/app.ts:30-33` (pass agentStore to routes that need it from preHandler)
- Test: `apps/server/src/__tests__/auth.test.ts` (new)

**Step 1: Write failing tests**

```typescript
// apps/server/src/__tests__/auth.test.ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

describe("authentication", () => {
  it("rejects chat/send with a fabricated Bearer token", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/send",
      headers: { authorization: "Bearer fake_not_a_real_key" },
      payload: { text: "spam" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects chat/send with no Bearer token", async () => {
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/send",
      payload: { text: "spam" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("allows chat/send with a valid registered agent key", async () => {
    const { app } = buildApp();
    const reg = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "auth-test" },
    });
    const { apiKey } = reg.json();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/chat/send",
      headers: { authorization: `Bearer ${apiKey}` },
      payload: { text: "hello" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().from).toBe("auth-test");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/server && npx vitest run src/__tests__/auth.test.ts`
Expected: First test FAILS (currently returns 200 with `from: "anonymous"`)

**Step 3: Refactor authenticateAgent to accept agentStore and fully verify**

Change `auth.ts` to accept `agentStore` and attach the full agent record:

```typescript
// apps/server/src/auth.ts
import { randomBytes, createHash } from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { AgentStore } from "./stores/agent-store.js";

export function generateApiKey(): string {
  return `rave_${randomBytes(24).toString("hex")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function createAuthenticateAgent(agentStore: AgentStore) {
  return async function authenticateAgent(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "Missing or invalid authorization header" });
    }
    const apiKey = authHeader.slice(7);
    const hash = hashApiKey(apiKey);
    const agent = agentStore.findByApiKeyHash(hash);
    if (!agent) {
      return reply.status(401).send({ error: "Unknown agent" });
    }
    (request as any).agent = agent;
  };
}
```

Update `app.ts` to create the authenticator with the store and pass it to routes:

```typescript
// In buildApp(), after creating agentStore:
const authenticateAgent = createAuthenticateAgent(agentStore);

// Pass authenticateAgent to each route plugin that needs it:
app.register(slotRoutes(engine, authenticateAgent));
app.register(sessionRoutes(engine, authenticateAgent));
app.register(chatRoutes(chatStore, authenticateAgent));
```

Update `routes/chat.ts` — remove the `?? "anonymous"` fallback, use `request.agent`:

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { ChatStore } from "../stores/chat-store.js";
import type { AgentRecord } from "@the-clawb/shared";

export function chatRoutes(chatStore: ChatStore, authenticateAgent: (req: FastifyRequest, reply: FastifyReply) => Promise<void>) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/chat/recent", async () => {
      return { messages: chatStore.recent() };
    });

    app.post("/api/v1/chat/send", { preHandler: authenticateAgent }, async (request, reply) => {
      const body = request.body as { text?: string } | undefined;
      if (!body?.text?.trim()) return reply.status(400).send({ error: "text required" });

      const agent = (request as any).agent as AgentRecord;
      const msg = chatStore.add(agent.name, body.text.trim());
      return reply.send(msg);
    });
  };
}
```

Update `routes/slots.ts` — use `request.agent` instead of re-looking up:

```typescript
export function slotRoutes(engine: SessionEngine, authenticateAgent: (req: FastifyRequest, reply: FastifyReply) => Promise<void>) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/slots/status", async () => {
      return engine.getClubState();
    });

    app.post("/api/v1/slots/book", { preHandler: authenticateAgent }, async (request, reply) => {
      const body = request.body as { type?: string } | undefined;
      if (!body?.type || !["dj", "vj"].includes(body.type)) {
        return reply.status(400).send({ error: "type must be 'dj' or 'vj'" });
      }

      const agent = (request as any).agent as AgentRecord;
      const result = engine.bookSlot(agent.id, agent.name, body.type as SlotType);
      engine.processQueue();
      return reply.send(result);
    });
  };
}
```

Update `routes/sessions.ts` — same pattern:

```typescript
export function sessionRoutes(engine: SessionEngine, authenticateAgent: (req: FastifyRequest, reply: FastifyReply) => Promise<void>) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/sessions/current", async () => { /* unchanged */ });

    app.post("/api/v1/sessions/code", { preHandler: authenticateAgent }, async (request, reply) => {
      const body = request.body as { type?: string; code?: string } | undefined;
      if (!body?.type || !body?.code) {
        return reply.status(400).send({ error: "type and code required" });
      }

      const agent = (request as any).agent as AgentRecord;
      const result = engine.pushCode(agent.id, { type: body.type as SlotType, code: body.code });
      if (!result.ok) return reply.status(403).send(result);
      return reply.send(result);
    });
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd apps/server && npx vitest run`
Expected: ALL tests pass (including existing e2e tests)

**Step 5: Commit**

```bash
git add apps/server/src/auth.ts apps/server/src/app.ts apps/server/src/routes/chat.ts apps/server/src/routes/slots.ts apps/server/src/routes/sessions.ts apps/server/src/__tests__/auth.test.ts
git commit -m "fix(auth): verify API key against store in preHandler — closes auth bypass on chat endpoint"
```

---

### Task 2: Restrict CORS to Configured Origin

Server hardcodes `origin: true` / `origin: "*"` while `.env.example` defines `CORS_ORIGIN` that is never read.

**Files:**
- Modify: `apps/server/src/app.ts:22` (Fastify CORS)
- Modify: `apps/server/src/socket/index.ts:18` (Socket.IO CORS)
- Test: `apps/server/src/__tests__/cors.test.ts` (new)

**Step 1: Write failing test**

```typescript
// apps/server/src/__tests__/cors.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../app.js";

describe("CORS configuration", () => {
  const originalEnv = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = originalEnv;
  });

  it("reflects configured CORS_ORIGIN in response headers", async () => {
    process.env.CORS_ORIGIN = "https://theclawb.dev";
    const { app } = buildApp();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: { origin: "https://evil.com", "access-control-request-method": "GET" },
    });
    // Should NOT reflect evil.com
    const acao = res.headers["access-control-allow-origin"];
    expect(acao).not.toBe("https://evil.com");
  });

  it("allows the configured origin", async () => {
    process.env.CORS_ORIGIN = "https://theclawb.dev";
    const { app } = buildApp();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/health",
      headers: { origin: "https://theclawb.dev", "access-control-request-method": "GET" },
    });
    const acao = res.headers["access-control-allow-origin"];
    expect(acao).toBe("https://theclawb.dev");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/server && npx vitest run src/__tests__/cors.test.ts`
Expected: First test FAILS (currently reflects any origin)

**Step 3: Read CORS_ORIGIN from env in both app.ts and socket/index.ts**

In `app.ts`:
```typescript
const corsOrigin = process.env.CORS_ORIGIN || true; // true = permissive in dev
app.register(cors, { origin: corsOrigin });
```

In `socket/index.ts`, accept origin parameter:
```typescript
export function setupSocketServer(
  httpServer: HttpServer,
  engine: SessionEngine,
  agentStore: AgentStore,
  chatStore: ChatStore,
  bus: ClubEventBus,
): Server {
  const corsOrigin = process.env.CORS_ORIGIN || "*";
  const io = new Server(httpServer, { cors: { origin: corsOrigin } });
  // ...
}
```

**Step 4: Run all tests**

Run: `cd apps/server && npx vitest run`
Expected: ALL pass

**Step 5: Commit**

```bash
git add apps/server/src/app.ts apps/server/src/socket/index.ts apps/server/src/__tests__/cors.test.ts
git commit -m "fix(cors): read CORS_ORIGIN from env instead of allowing all origins"
```

---

### Task 3: Validate Socket.IO Inputs — Audience Namespace

Audience `chat:send` accepts any type/shape for `nickname` and `text` with no validation.

**Files:**
- Modify: `apps/server/src/socket/audience-namespace.ts:15-18`
- Create: `apps/server/src/validation.ts`
- Test: `apps/server/src/__tests__/validation.test.ts` (new)

**Step 1: Write failing tests for validation helpers**

```typescript
// apps/server/src/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeChatText, sanitizeNickname } from "../validation.js";

describe("sanitizeChatText", () => {
  it("returns trimmed string for valid input", () => {
    expect(sanitizeChatText("  hello  ")).toBe("hello");
  });

  it("returns null for non-string input", () => {
    expect(sanitizeChatText(123)).toBeNull();
    expect(sanitizeChatText(null)).toBeNull();
    expect(sanitizeChatText(undefined)).toBeNull();
    expect(sanitizeChatText({ text: "hi" })).toBeNull();
  });

  it("returns null for empty/whitespace string", () => {
    expect(sanitizeChatText("")).toBeNull();
    expect(sanitizeChatText("   ")).toBeNull();
  });

  it("truncates to 500 characters", () => {
    const long = "a".repeat(600);
    expect(sanitizeChatText(long)!.length).toBe(500);
  });

  it("strips HTML tags", () => {
    expect(sanitizeChatText('<script>alert(1)</script>')).toBe("alert(1)");
    expect(sanitizeChatText('<img src=x onerror=alert(1)>')).toBe("");
  });
});

describe("sanitizeNickname", () => {
  it("returns trimmed string for valid input", () => {
    expect(sanitizeNickname("cool-dj")).toBe("cool-dj");
  });

  it("returns null for non-string input", () => {
    expect(sanitizeNickname(123)).toBeNull();
  });

  it("truncates to 20 characters", () => {
    expect(sanitizeNickname("a".repeat(30))!.length).toBe(20);
  });

  it("strips HTML tags", () => {
    expect(sanitizeNickname('<b>bold</b>')).toBe("bold");
  });

  it("returns null for empty after sanitization", () => {
    expect(sanitizeNickname("<>")).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/server && npx vitest run src/__tests__/validation.test.ts`
Expected: FAIL — module not found

**Step 3: Implement validation helpers**

```typescript
// apps/server/src/validation.ts
const HTML_TAG_RE = /<[^>]*>/g;

function stripHtml(s: string): string {
  return s.replace(HTML_TAG_RE, "");
}

export function sanitizeChatText(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = stripHtml(input).trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 500);
}

export function sanitizeNickname(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = stripHtml(input).trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 20);
}

export function isValidSlotType(input: unknown): input is "dj" | "vj" {
  return input === "dj" || input === "vj";
}

export function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}
```

**Step 4: Run validation tests**

Run: `cd apps/server && npx vitest run src/__tests__/validation.test.ts`
Expected: ALL pass

**Step 5: Apply validation in audience-namespace.ts**

```typescript
// apps/server/src/socket/audience-namespace.ts
import type { Server } from "socket.io";
import type { ChatStore } from "../stores/chat-store.js";
import { sanitizeChatText, sanitizeNickname } from "../validation.js";

export function setupAudienceNamespace(io: Server, chatStore: ChatStore): void {
  const audienceNsp = io.of("/audience");

  const emitCount = async () => {
    const sockets = await audienceNsp.fetchSockets();
    audienceNsp.emit("audience:count", { count: sockets.length });
  };

  audienceNsp.on("connection", async (socket) => {
    await emitCount();

    socket.on("chat:send", (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const { text, nickname } = data as Record<string, unknown>;
      const sanitizedText = sanitizeChatText(text);
      if (!sanitizedText) return; // silently drop invalid messages

      const sanitizedNick = sanitizeNickname(nickname);
      const from = sanitizedNick ?? `anon-${socket.id.slice(0, 4)}`;
      const msg = chatStore.add(from, sanitizedText);
      audienceNsp.emit("chat:message", msg);
    });

    socket.on("disconnect", async () => {
      await emitCount();
    });
  });
}
```

**Step 6: Run all tests**

Run: `cd apps/server && npx vitest run`
Expected: ALL pass

**Step 7: Commit**

```bash
git add apps/server/src/validation.ts apps/server/src/socket/audience-namespace.ts apps/server/src/__tests__/validation.test.ts
git commit -m "fix(validation): sanitize audience chat inputs — strip HTML, enforce length limits"
```

---

### Task 4: Validate Socket.IO Inputs — Agent Namespace

Agent `code:push` and `chat:send` pass unvalidated data through.

**Files:**
- Modify: `apps/server/src/socket/agent-namespace.ts:24-38`

**Step 1: Write failing test**

```typescript
// Add to apps/server/src/__tests__/validation.test.ts
import { isValidSlotType, isNonEmptyString } from "../validation.js";

describe("isValidSlotType", () => {
  it("accepts dj and vj", () => {
    expect(isValidSlotType("dj")).toBe(true);
    expect(isValidSlotType("vj")).toBe(true);
  });

  it("rejects other values", () => {
    expect(isValidSlotType("__proto__")).toBe(false);
    expect(isValidSlotType(undefined)).toBe(false);
    expect(isValidSlotType(123)).toBe(false);
  });
});

describe("isNonEmptyString", () => {
  it("accepts non-empty strings", () => {
    expect(isNonEmptyString("hello")).toBe(true);
  });

  it("rejects non-strings and empty strings", () => {
    expect(isNonEmptyString("")).toBe(false);
    expect(isNonEmptyString("  ")).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString({})).toBe(false);
  });
});
```

**Step 2: Run tests to verify they pass (helpers already exist from Task 3)**

Run: `cd apps/server && npx vitest run src/__tests__/validation.test.ts`
Expected: PASS

**Step 3: Apply validation in agent-namespace.ts**

```typescript
// apps/server/src/socket/agent-namespace.ts
import type { Server } from "socket.io";
import { hashApiKey } from "../auth.js";
import type { SessionEngine } from "../session-engine/engine.js";
import type { AgentStore } from "../stores/agent-store.js";
import { isValidSlotType, isNonEmptyString, sanitizeChatText } from "../validation.js";

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

    socket.on("code:push", (data: unknown) => {
      if (!data || typeof data !== "object") {
        return socket.emit("code:ack", { ok: false, error: "Invalid payload" });
      }
      const { type, code } = data as Record<string, unknown>;
      if (!isValidSlotType(type) || !isNonEmptyString(code)) {
        return socket.emit("code:ack", { ok: false, error: "type must be 'dj'|'vj' and code must be a non-empty string" });
      }
      const result = engine.pushCode(agentId, { type, code: code as string });
      socket.emit("code:ack", result);
    });

    socket.on("chat:send", (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const { text } = data as Record<string, unknown>;
      const sanitized = sanitizeChatText(text);
      if (!sanitized) return;

      io.of("/audience").emit("chat:message", {
        from: socket.data.agentName,
        text: sanitized,
        timestamp: Date.now(),
      });
    });
  });
}
```

**Step 4: Run all tests**

Run: `cd apps/server && npx vitest run`
Expected: ALL pass

**Step 5: Commit**

```bash
git add apps/server/src/socket/agent-namespace.ts apps/server/src/__tests__/validation.test.ts
git commit -m "fix(validation): validate code:push and chat:send payloads in agent namespace"
```

---

### Task 5: Add REST Input Validation for code:push Type Field

The REST `POST /api/v1/sessions/code` checks that `type` and `code` exist but doesn't validate `type ∈ {"dj","vj"}`.

**Files:**
- Modify: `apps/server/src/routes/sessions.ts:22-24`

**Step 1: Write failing test**

```typescript
// Add to apps/server/src/__tests__/e2e.test.ts
it("rejects code push with invalid slot type", async () => {
  const { app } = buildApp();
  const reg = await app.inject({
    method: "POST",
    url: "/api/v1/agents/register",
    payload: { name: "type-test" },
  });
  const { apiKey } = reg.json();
  const auth = { authorization: `Bearer ${apiKey}` };

  await app.inject({
    method: "POST",
    url: "/api/v1/slots/book",
    headers: auth,
    payload: { type: "dj" },
  });

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/sessions/code",
    headers: auth,
    payload: { type: "__proto__", code: "malicious" },
  });
  expect(res.statusCode).toBe(400);
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/__tests__/e2e.test.ts`
Expected: FAIL — currently returns 403 (not active agent) instead of 400 (bad input)

**Step 3: Add type validation**

In `routes/sessions.ts`, add validation after the existing `!body?.type || !body?.code` check:

```typescript
if (!["dj", "vj"].includes(body.type)) {
  return reply.status(400).send({ error: "type must be 'dj' or 'vj'" });
}
if (typeof body.code !== "string" || !body.code.trim()) {
  return reply.status(400).send({ error: "code must be a non-empty string" });
}
```

**Step 4: Run all tests**

Run: `cd apps/server && npx vitest run`
Expected: ALL pass

**Step 5: Commit**

```bash
git add apps/server/src/routes/sessions.ts apps/server/src/__tests__/e2e.test.ts
git commit -m "fix(validation): reject invalid slot types in REST code push endpoint"
```

---

### Task 6: Prevent Chat Nickname Spoofing — Add Role Field

Audience members can set any nickname including agent names. Add a `role` field to chat messages.

**Files:**
- Modify: `apps/server/src/stores/chat-store.ts:1-5,11`
- Modify: `apps/server/src/socket/audience-namespace.ts:17`
- Modify: `apps/server/src/socket/agent-namespace.ts:34-38`
- Modify: `apps/server/src/routes/chat.ts` (REST chat also needs role)
- Modify: `apps/web/src/components/chat-panel.tsx:4-8,39-42`
- Test: `apps/server/src/__tests__/chat.test.ts` (new)

**Step 1: Write failing test**

```typescript
// apps/server/src/__tests__/chat.test.ts
import { describe, it, expect } from "vitest";
import { ChatStore } from "../stores/chat-store.js";

describe("ChatStore", () => {
  it("stores messages with a role field", () => {
    const store = new ChatStore();
    const msg = store.add("dj-bot", "hello", "agent");
    expect(msg.role).toBe("agent");
  });

  it("defaults role to audience", () => {
    const store = new ChatStore();
    const msg = store.add("anon-1234", "hi");
    expect(msg.role).toBe("audience");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/server && npx vitest run src/__tests__/chat.test.ts`
Expected: FAIL — `add` doesn't accept/return role

**Step 3: Add role to ChatStore**

```typescript
// apps/server/src/stores/chat-store.ts
export type ChatRole = "agent" | "audience";

export interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
  role: ChatRole;
}

export class ChatStore {
  private messages: ChatMessage[] = [];
  private maxMessages = 200;

  add(from: string, text: string, role: ChatRole = "audience"): ChatMessage {
    const msg: ChatMessage = { from, text, timestamp: Date.now(), role };
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

**Step 4: Run chat tests**

Run: `cd apps/server && npx vitest run src/__tests__/chat.test.ts`
Expected: PASS

**Step 5: Update callers to pass role**

In `audience-namespace.ts`, the `chatStore.add` call:
```typescript
const msg = chatStore.add(from, sanitizedText, "audience");
```

In `agent-namespace.ts`, the direct broadcast (doesn't use chatStore — also fix this to store):
```typescript
socket.on("chat:send", (data: unknown) => {
  if (!data || typeof data !== "object") return;
  const { text } = data as Record<string, unknown>;
  const sanitized = sanitizeChatText(text);
  if (!sanitized) return;

  // Store in chatStore for consistency, then broadcast
  // Note: chatStore must be passed to setupAgentNamespace
  io.of("/audience").emit("chat:message", {
    from: socket.data.agentName,
    text: sanitized,
    timestamp: Date.now(),
    role: "agent" as const,
  });
});
```

In `routes/chat.ts`:
```typescript
const msg = chatStore.add(agent.name, body.text.trim(), "agent");
```

**Step 6: Update frontend ChatPanel to show role**

```tsx
// apps/web/src/components/chat-panel.tsx — update the ChatMessage interface
interface ChatMessage {
  from: string;
  text: string;
  timestamp: number;
  role?: "agent" | "audience";
}

// In the message rendering:
<span className={msg.role === "agent" ? "text-purple-400" : "text-cyan-400"}>
  {msg.from}:
</span>
```

**Step 7: Run all tests**

Run: `cd apps/server && npx vitest run`
Expected: ALL pass

**Step 8: Commit**

```bash
git add apps/server/src/stores/chat-store.ts apps/server/src/socket/audience-namespace.ts apps/server/src/socket/agent-namespace.ts apps/server/src/routes/chat.ts apps/server/src/__tests__/chat.test.ts apps/web/src/components/chat-panel.tsx
git commit -m "feat(chat): add role field to chat messages — prevents agent impersonation"
```

---

### Task 7: Sanitize Agent Names at Registration

Agent names can contain HTML/script content which gets broadcast unsanitized.

**Files:**
- Modify: `apps/server/src/routes/agents.ts:10-14`
- Test: add to `apps/server/src/__tests__/agents.test.ts`

**Step 1: Write failing test**

```typescript
// Add to apps/server/src/__tests__/agents.test.ts
it("strips HTML from agent name", async () => {
  const { app } = buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/agents/register",
    payload: { name: '<script>alert(1)</script>DJ' },
  });
  expect(res.statusCode).toBe(201);
  // Name should be sanitized
  // Verify via slot booking or status
});

it("rejects names that are empty after sanitization", async () => {
  const { app } = buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/agents/register",
    payload: { name: '<img src=x>' },
  });
  expect(res.statusCode).toBe(400);
});

it("rejects names longer than 30 characters", async () => {
  const { app } = buildApp();
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/agents/register",
    payload: { name: "a".repeat(31) },
  });
  expect(res.statusCode).toBe(400);
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/server && npx vitest run src/__tests__/agents.test.ts`
Expected: FAIL — currently accepts HTML names and long names

**Step 3: Add sanitization to agent registration**

```typescript
// apps/server/src/routes/agents.ts — update the validation block
import { sanitizeNickname } from "../validation.js";

// Replace the existing name validation:
const rawName = body.name.trim();
const name = sanitizeNickname(rawName);
if (!name || name.length < 2) {
  return reply.status(400).send({ error: "name is required (2-20 chars, no HTML)" });
}
if (name.length > 30) {
  return reply.status(400).send({ error: "name too long (max 30 chars)" });
}
```

Note: `sanitizeNickname` from Task 3 already strips HTML and caps at 20. Adjust the limit to 30 for agent names, or create a dedicated `sanitizeAgentName` with a 30-char limit. Simplest: just use the strip-HTML logic and enforce 2-30 chars inline.

```typescript
const HTML_TAG_RE = /<[^>]*>/g;
const name = body.name.trim().replace(HTML_TAG_RE, "").trim();
if (name.length < 2 || name.length > 30) {
  return reply.status(400).send({ error: "name must be 2-30 chars, no HTML" });
}
```

**Step 4: Run all tests**

Run: `cd apps/server && npx vitest run`
Expected: ALL pass

**Step 5: Commit**

```bash
git add apps/server/src/routes/agents.ts apps/server/src/__tests__/agents.test.ts
git commit -m "fix(agents): sanitize agent names — strip HTML, enforce length limits"
```

---

### Task 8: Gate Agent Registration Behind Admin Secret

Anyone can register agents. Add an optional `ADMIN_SECRET` env var — when set, registration requires it.

**Files:**
- Modify: `apps/server/src/routes/agents.ts:8`
- Test: add to `apps/server/src/__tests__/agents.test.ts`

**Step 1: Write failing test**

```typescript
// Add to apps/server/src/__tests__/agents.test.ts
import { beforeEach, afterEach } from "vitest";

describe("agent registration with ADMIN_SECRET", () => {
  const originalSecret = process.env.ADMIN_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.ADMIN_SECRET;
    else process.env.ADMIN_SECRET = originalSecret;
  });

  it("rejects registration without admin secret when ADMIN_SECRET is set", async () => {
    process.env.ADMIN_SECRET = "test-secret-123";
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "blocked-agent" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("accepts registration with correct admin secret", async () => {
    process.env.ADMIN_SECRET = "test-secret-123";
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      headers: { "x-admin-secret": "test-secret-123" },
      payload: { name: "allowed-agent" },
    });
    expect(res.statusCode).toBe(201);
  });

  it("allows open registration when ADMIN_SECRET is not set", async () => {
    delete process.env.ADMIN_SECRET;
    const { app } = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/agents/register",
      payload: { name: "open-agent" },
    });
    expect(res.statusCode).toBe(201);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd apps/server && npx vitest run src/__tests__/agents.test.ts`
Expected: First test FAILS (currently returns 201)

**Step 3: Add admin secret check**

```typescript
// At the top of the POST handler in agents.ts:
const adminSecret = process.env.ADMIN_SECRET;
if (adminSecret) {
  const provided = request.headers["x-admin-secret"];
  if (provided !== adminSecret) {
    return reply.status(403).send({ error: "Admin secret required for registration" });
  }
}
```

**Step 4: Run all tests**

Run: `cd apps/server && npx vitest run`
Expected: ALL pass. Existing tests work because `ADMIN_SECRET` is not set in test env.

**Step 5: Commit**

```bash
git add apps/server/src/routes/agents.ts apps/server/src/__tests__/agents.test.ts
git commit -m "feat(auth): gate agent registration behind optional ADMIN_SECRET env var"
```

---

### Task 9: Sandbox Hydra/Strudel Execution in Iframe

This is the most critical fix. Server-supplied code runs via `eval()` in the main window with full DOM/cookie access. Isolate in a sandboxed iframe.

**Files:**
- Create: `apps/web/public/sandbox/hydra-sandbox.html`
- Create: `apps/web/public/sandbox/strudel-sandbox.html`
- Create: `apps/web/src/lib/sandbox-bridge.ts`
- Modify: `apps/web/src/components/hydra-canvas.tsx` (use iframe instead of direct eval)
- Modify: `apps/web/src/components/strudel-player.tsx` (use iframe instead of direct eval)

**Step 1: Design the sandbox architecture**

Each engine runs in a sandboxed iframe:
- `<iframe sandbox="allow-scripts" src="/sandbox/hydra-sandbox.html">`
- `<iframe sandbox="allow-scripts" src="/sandbox/strudel-sandbox.html">`

The `allow-scripts` permission is required for `eval()`. The absence of `allow-same-origin` means the iframe cannot access `document.cookie`, `localStorage`, `fetch` to the parent origin, or the parent `window`.

Communication: `postMessage` only. Parent sends `{ type: "eval", code: "..." }`, sandbox replies `{ type: "error", message: "..." }` if eval fails.

**Step 2: Create Hydra sandbox HTML**

```html
<!-- apps/web/public/sandbox/hydra-sandbox.html -->
<!DOCTYPE html>
<html><head>
<style>* { margin: 0; padding: 0; } canvas { width: 100%; height: 100%; display: block; }</style>
</head><body>
<canvas id="c"></canvas>
<script type="module">
  // Import hydra-synth from CDN (can't access parent's node_modules)
  import Hydra from "https://esm.sh/hydra-synth@1.3.29";

  const canvas = document.getElementById("c");
  const fft = new Float32Array(5);
  window.a = { fft, setSmooth(){}, setScale(){}, setCutoff(){}, setBands(){}, setBins(){}, show(){}, hide(){} };

  const hydra = new Hydra({
    canvas,
    width: canvas.width,
    height: canvas.height,
    detectAudio: false,
    makeGlobal: true,
    autoLoop: true,
    enableStreamCapture: false,
    numSources: 4,
    numOutputs: 4,
  });

  // Re-establish audio stub after hydra init
  window.a = { fft, setSmooth(){}, setScale(){}, setCutoff(){}, setBands(){}, setBins(){}, show(){}, hide(){} };

  window.addEventListener("message", (e) => {
    try {
      if (e.data?.type === "eval") {
        hydra.hush();
        hydra.eval(e.data.code);
        e.source.postMessage({ type: "ack" }, "*");
      } else if (e.data?.type === "resize") {
        canvas.width = e.data.width;
        canvas.height = e.data.height;
        hydra.setResolution(e.data.width, e.data.height);
      } else if (e.data?.type === "audio") {
        fft.set(e.data.fft);
      }
    } catch (err) {
      e.source.postMessage({ type: "error", message: err.message }, "*");
    }
  });

  // Signal ready
  parent.postMessage({ type: "ready" }, "*");
</script>
</body></html>
```

**Step 3: Create Strudel sandbox HTML**

```html
<!-- apps/web/public/sandbox/strudel-sandbox.html -->
<!DOCTYPE html>
<html><head></head><body>
<script type="module">
  import { initStrudel, evaluate, hush, getAudioContext } from "https://esm.sh/@strudel/web@1.1.2";

  let ready = false;

  async function init() {
    await initStrudel();
    const ctx = getAudioContext?.();
    if (ctx?.state === "suspended") await ctx.resume();
    await evaluate(`await samples('github:tidalcycles/dirt-samples')`);
    ready = true;
    parent.postMessage({ type: "ready" }, "*");
  }

  window.addEventListener("message", async (e) => {
    try {
      if (e.data?.type === "init") {
        await init();
      } else if (e.data?.type === "eval" && ready) {
        await evaluate(e.data.code);
        e.source.postMessage({ type: "ack" }, "*");
      } else if (e.data?.type === "hush") {
        hush();
      }
    } catch (err) {
      e.source.postMessage({ type: "error", message: err.message }, "*");
    }
  });
</script>
</body></html>
```

**Step 4: Create postMessage bridge utility**

```typescript
// apps/web/src/lib/sandbox-bridge.ts
type MessageHandler = (data: unknown) => void;

export class SandboxBridge {
  private iframe: HTMLIFrameElement;
  private handlers = new Map<string, MessageHandler[]>();
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    this.readyPromise = new Promise((r) => { this.resolveReady = r; });

    window.addEventListener("message", (e) => {
      if (e.source !== iframe.contentWindow) return;
      const { type, ...rest } = e.data ?? {};
      if (type === "ready") {
        this.resolveReady();
        return;
      }
      const fns = this.handlers.get(type);
      fns?.forEach((fn) => fn(rest));
    });
  }

  async waitReady(): Promise<void> {
    return this.readyPromise;
  }

  send(type: string, data?: Record<string, unknown>): void {
    this.iframe.contentWindow?.postMessage({ type, ...data }, "*");
  }

  on(type: string, handler: MessageHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  destroy(): void {
    this.handlers.clear();
  }
}
```

**Step 5: Refactor HydraCanvas to use iframe sandbox**

Replace direct `hydra.eval()` with an iframe + postMessage bridge. The visual output lives inside the iframe's canvas. The iframe is positioned to fill the parent container.

```tsx
// apps/web/src/components/hydra-canvas.tsx
"use client";

import { useEffect, useRef, useCallback } from "react";
import { SandboxBridge } from "../lib/sandbox-bridge";

interface HydraCanvasProps {
  code: string;
  className?: string;
}

export function HydraCanvas({ code, className }: HydraCanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<SandboxBridge | null>(null);
  const readyRef = useRef<Promise<void> | null>(null);

  const evalCode = useCallback(async (newCode: string) => {
    if (readyRef.current) await readyRef.current;
    bridgeRef.current?.send("eval", { code: newCode });
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || bridgeRef.current) return;

    const bridge = new SandboxBridge(iframe);
    bridgeRef.current = bridge;
    readyRef.current = bridge.waitReady();

    return () => {
      bridge.destroy();
      bridgeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (code) evalCode(code);
  }, [code, evalCode]);

  return (
    <div className={className} style={{ overflow: "hidden", position: "relative" }}>
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        src="/sandbox/hydra-sandbox.html"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
        }}
      />
    </div>
  );
}
```

**Step 6: Refactor StrudelPlayer to use iframe sandbox**

Similar pattern. The iframe handles audio — user gesture must happen inside the iframe for AudioContext unlock, so the init is triggered via postMessage after the user clicks in the parent.

```tsx
// apps/web/src/components/strudel-player.tsx — key changes:
// 1. Replace direct import("@strudel/web") with iframe
// 2. On user gesture in parent, postMessage "init" to iframe
// 3. On code change, postMessage "eval" to iframe
// 4. Remove all the globalThis shielding code (no longer needed)
```

> **Note:** Strudel sandbox is trickier because AudioContext requires a user gesture. The iframe's `allow-scripts` without `allow-same-origin` may restrict AudioContext creation in some browsers. If this doesn't work, use `sandbox="allow-scripts allow-same-origin"` with a different-origin iframe (e.g., served from a subdomain like `sandbox.theclawb.dev`). Test in Chrome, Firefox, and Safari.

**Step 7: Test manually**

1. Start the dev server: `cd apps/web && pnpm dev`
2. Open browser, click to start
3. Verify Hydra visuals render inside the iframe
4. Verify Strudel audio plays
5. Open DevTools console, confirm the iframe has a different origin (null for sandbox without allow-same-origin)
6. In the iframe's console, verify `parent.document` throws (cross-origin blocked)

**Step 8: Run existing tests**

Run: `cd apps/server && npx vitest run`
Expected: ALL pass (server tests are unaffected)

**Step 9: Commit**

```bash
git add apps/web/public/sandbox/hydra-sandbox.html apps/web/public/sandbox/strudel-sandbox.html apps/web/src/lib/sandbox-bridge.ts apps/web/src/components/hydra-canvas.tsx apps/web/src/components/strudel-player.tsx
git commit -m "feat(security): sandbox Hydra and Strudel in iframes — prevents eval'd code from accessing parent DOM"
```

---

## Summary

| Task | Vuln | Severity | Description |
|------|------|----------|-------------|
| 1 | V3 | HIGH | Fix auth preHandler to verify API key against store |
| 2 | V4 | MEDIUM | Restrict CORS to configured origin |
| 3 | V5 | MEDIUM | Validate audience chat inputs |
| 4 | V7,V8 | MEDIUM | Validate agent namespace inputs |
| 5 | V7 | MEDIUM | Validate REST code push type field |
| 6 | V6 | MEDIUM | Add role field to prevent nickname spoofing |
| 7 | V2 | HIGH | Sanitize agent names |
| 8 | V2 | HIGH | Gate registration behind admin secret |
| 9 | V1 | HIGH | Sandbox code execution in iframes |

Tasks 1-8 are server-side and low-risk. Task 9 is the largest (frontend architectural change) and should be carefully tested across browsers.
