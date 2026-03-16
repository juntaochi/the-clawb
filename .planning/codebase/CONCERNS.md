# CONCERNS — Technical Debt, Risks & Known Issues

## Security

### In-Memory Stores — No Persistence
- `InMemoryAgentStore` and `ChatStore` lose all data on server restart
- Registered agents must re-register after every deployment
- **Risk:** Medium — acceptable for MVP but blocks production reliability
- **Files:** `apps/server/src/stores/agent-store.ts`, `apps/server/src/stores/chat-store.ts`

### Auth Middleware Uses Untyped Cast
- `createAuthenticateAgent` sets `(request as any).agent` — no compile-time safety
- **Risk:** Low — pattern is isolated and consistent, but fragile
- **File:** `apps/server/src/auth.ts:25`

### No Rate Limiting on Registration
- `POST /api/v1/agents/register` has no rate limiting
- Agent store grows unbounded (queue capped at 20, but store is not)
- **Risk:** Medium — potential DoS vector

### No HTTPS Enforcement
- Relies on deployment platform (Railway/Vercel) for TLS
- **Risk:** Low — acceptable for platform-managed deploys

## Architecture

### Socket.IO Broadcaster Has Untyped Casts
- `broadcaster.ts` casts event data with `as { type: string }` etc.
- Event bus uses `unknown` data type — no end-to-end type safety
- **Risk:** Low — could silently break if event shapes change
- **Files:** `apps/server/src/socket/broadcaster.ts`, `apps/server/src/event-bus.ts`

### Audience Count Always Zero
- `getClubState()` returns `audienceCount: 0` hardcoded
- Socket.IO audience connections are not tracked
- **Risk:** Low — cosmetic, but status bar shows "0 listening" always
- **File:** `apps/server/src/session-engine/engine.ts:53`

### No Graceful Shutdown
- No SIGTERM/SIGINT handlers — active sessions and timers not cleaned up
- **Risk:** Medium — Railway sends SIGTERM on deploy, sessions would be orphaned

## Performance

### Chat Store Growth
- ChatStore may accumulate messages without bounds (verify ring buffer cap)
- **Risk:** Medium — production club could run for days

### No Connection Limits
- Socket.IO audience namespace accepts unlimited connections
- No per-client throttling on error reports (5s debounce per slot, not per client)
- **Risk:** Medium — open WebSocket endpoint could be targeted

## Frontend

### No Error Boundaries
- Dashboard has no React error boundaries
- Hydra/Strudel iframe crash could blank entire UI
- **Risk:** Medium — third-party rendering engines have varying stability

### Initial State Race Condition
- `useClubSocket` fetches via REST and listens on Socket.IO simultaneously
- Socket event could be overwritten by stale REST response
- **Risk:** Low — edge case exists
- **File:** `apps/web/src/hooks/use-club-socket.ts:54-74`

### No Reconnection Indicator
- Socket disconnections have no user-facing UI indicator
- **Risk:** Low — cosmetic

## Testing Gaps

### No Frontend Tests
- Zero test files in `apps/web/`
- **Risk:** Medium — UI changes could silently break

### Socket.IO Handlers Untested
- `broadcaster.ts`, `agent-namespace.ts`, `audience-namespace.ts` have no direct tests
- **Risk:** Medium — real-time event flow is the core product

## Technical Debt

### Dist Directory
- `apps/server/dist/` contains compiled output — should be gitignored
- **Risk:** Low — merge conflicts and stale artifacts

### Duplicate Default Codes
- Default DJ/VJ codes exist in both `packages/shared/src/defaults.ts` and `apps/web/src/lib/defaults.ts`
- **Risk:** Low — potential divergence

### No Observability
- Fastify logger disabled (`logger: false`)
- No metrics, no error reporting, no monitoring
- **Risk:** High for production — blind to issues until users report
