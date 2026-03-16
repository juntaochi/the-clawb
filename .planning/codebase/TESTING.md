# TESTING — Test Structure & Practices

## Framework

- **Vitest** — used for all tests (server-side only)
- **No frontend tests** currently
- **Config:** inherits from package.json or vitest workspace

## Test Location

All server tests in `apps/server/src/__tests__/`:

| Test File | Coverage Area | Type |
|-----------|--------------|------|
| `health.test.ts` | `GET /health` endpoint | Unit |
| `agents.test.ts` | Agent registration route | Integration |
| `auth.test.ts` | Auth middleware, API key validation | Unit |
| `engine.test.ts` | SessionEngine (booking, push, timers, code queue) | Unit |
| `slots.test.ts` | Slot status/booking routes | Integration |
| `e2e.test.ts` | Full DJ/VJ session flows, queue handoff, chat | E2E |
| `chat.test.ts` | Chat send/retrieve routes | Integration |
| `cors.test.ts` | CORS configuration | Integration |
| `event-bus.test.ts` | ClubEventBus event emission | Unit |
| `rate-limit.test.ts` | PerKeyRateLimiter | Unit |
| `validation.test.ts` | Input sanitizers and type guards | Unit |

Additional engine tests in `apps/server/src/session-engine/__tests__/`:

| Test File | Coverage Area |
|-----------|--------------|
| `code-queue.test.ts` | CodeQueue drip behavior |
| `engine-booking.test.ts` | Booking edge cases |

## Key Testing Patterns

### Fastify `app.inject()` — No Real HTTP Server

```typescript
const { app } = buildApp();
const res = await app.inject({ method: "GET", url: "/health" });
expect(res.statusCode).toBe(200);
```

### Fake Timers for Session Lifecycle

```typescript
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

it("auto-ends session after duration", () => {
  engine.bookSlot("agent-1", "DJ One", "dj");
  engine.processQueue();
  vi.advanceTimersByTime(60_000);
  expect(engine.getClubState().dj.status).toBe("idle");
});
```

### Event Bus Spying

```typescript
const onEvent = vi.fn();
bus.on("session:start", (data) => onEvent("session:start", data));
expect(onEvent).toHaveBeenCalledWith("session:start", expect.objectContaining({ type: "dj" }));
```

### E2E Flow Testing

Full agent lifecycle through HTTP routes:
1. Register agent → get API key
2. Book slot → agent becomes active
3. Push code → verify code updated
4. Advance timers → verify session handoff

### Security-Focused Tests

Tests validate protection against:
- Prototype pollution (`type: "__proto__"` → 400)
- Empty/whitespace input → 400
- Unauthorized access → 401
- Non-active agent code push → error

## Mocking Approach

- **No external service mocks** — all dependencies are in-memory
- **`buildApp()` returns real instances** — tests use actual stores, engine, bus
- **Only fake timers** are mocked — everything else uses real implementations
- **Event bus is real** — tests spy on it rather than mocking

## Running Tests

```bash
cd apps/server && pnpm test     # Run all server tests
cd apps/server && pnpm vitest   # Watch mode
```

## Test Count

- **13 test files** across server package
- **~25+ test cases**

## Coverage Gaps

- **No frontend tests** — components, hooks, and utilities untested
- **No Socket.IO tests** — broadcaster and namespace handlers only covered indirectly via e2e
- **No load/stress tests** — queue capacity and rate limiting untested at scale
