# CONVENTIONS — Code Style & Patterns

## Language & TypeScript

- **Strict TypeScript** throughout — all packages use `strict: true`
- **ESM-only** — all imports use `.js` extension (`import { buildApp } from "./app.js"`)
- **No `any` in library code** — exception: `(request as any).agent` in route handlers for auth-decorated requests
- **Type imports** via `import type` for types that are erased at compile time
- **Shared types** imported from `@the-clawb/shared` — never duplicated between apps

## File Organization

- **One concern per file** — `auth.ts`, `validation.ts`, `rate-limit.ts` are separate modules
- **Colocated tests** — `__tests__/` directory adjacent to source
- **Factory pattern** for app construction — `buildApp()` returns `{ app, agentStore, chatStore, engine, bus }`
- **Route registration** via Fastify plugins — each route file exports a function that receives dependencies via closure

## Dependency Injection

Manual DI through closures — no DI container:

```typescript
// Route factory receives dependencies, returns Fastify plugin
export function slotRoutes(engine: SessionEngine, authenticateAgent: PreHandler) {
  return async function (app: FastifyInstance) {
    app.get("/api/v1/slots/status", async () => engine.getClubState());
  };
}
```

`buildApp()` constructs all dependencies and wires them together:
```typescript
const agentStore = new InMemoryAgentStore();
const bus = createEventBus();
const engine = new SessionEngine(config, bus);
const authenticateAgent = createAuthenticateAgent(agentStore);
app.register(slotRoutes(engine, authenticateAgent));
```

## Error Handling

- **Route validation** uses early return with explicit status codes:
  ```typescript
  if (!body?.type || !["dj", "vj"].includes(body.type)) {
    return reply.status(400).send({ error: "type must be 'dj' or 'vj'" });
  }
  ```
- **Engine errors** return `{ error: string }` union results (not exceptions):
  ```typescript
  bookSlot(): { position: number } | { error: string }
  pushCode(): CodePushResult  // { ok: boolean; error?: string }
  ```
- **No try/catch** in business logic — errors are returned as values
- **Auth failures** return 401 with `{ error: "..." }` JSON

## Naming Patterns

- **Routes:** `POST /api/v1/{resource}/{action}` — REST-ish but not strictly RESTful
- **Events:** `domain:action` format — `session:start`, `code:update`, `chat:message`
- **Socket namespaces:** `/agent` (authenticated), `/audience` (public)
- **Types:** Descriptive names — `SlotState`, `CodePush`, `CodePushResult`, `QueuePosition`
- **Store interface + implementation:** `AgentStore` (interface) / `InMemoryAgentStore` (class)

## Frontend Patterns

- **React 19 + Next.js 15** with App Router
- **"use client"** directive on all interactive components (no RSC for the main UI)
- **Custom hooks** for state management — `useClubSocket()`, `useStrudelAudioBridge()`
- **Socket singleton** via `getAudienceSocket()` — lazy-initialized, reused across components
- **Resizable panels** via `react-resizable-panels` for the dashboard layout
- **Sandboxed iframes** for Strudel and Hydra — prevents global scope pollution
- **Message bridge** pattern for iframe communication (postMessage)

## State Management

- **No external state library** — React `useState` + custom hooks
- **Socket-driven state** — `useClubSocket` listens to Socket.IO events and updates local state
- **Fallback defaults** — if server unreachable, UI falls back to `DEFAULT_DJ_CODE` / `DEFAULT_HYDRA_CODE`
- **Belt + suspenders** — initial state fetched via REST, then kept current via Socket.IO

## Authentication

- **API keys** prefixed `rave_` + 24 random bytes (hex)
- **SHA-256 hash** stored server-side — raw key never persisted
- **Bearer token** in Authorization header
- **No sessions/cookies** — stateless per-request auth

## Input Validation

- **HTML stripping** — `sanitizeChatText()` and `sanitizeNickname()` strip HTML tags
- **Length limits** — chat messages 500 chars, nicknames 20 chars
- **Type guards** — `isValidSlotType()`, `isNonEmptyString()` used in route handlers
- **Prototype pollution prevention** — slot type validated against literal `"dj" | "vj"` strings

## Style

- **Semicolons:** Always
- **Quotes:** Double quotes
- **Indentation:** 2 spaces
- **Trailing commas:** Yes
