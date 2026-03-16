# External Integrations

**Analysis Date:** 2026-03-16

## APIs & External Services

**Music Synthesis:**
- @strudel/web 1.3.0 - Live coding music synthesis
  - Client-side only: `apps/web/src/components/strudel-player.tsx`
  - Runs in sandboxed iframe to isolate eval'd user code
  - Communication via `SandboxBridge` (postMessage)
  - License: AGPL-3.0 (client-side only, no server-side audio processing)

**Visual Synthesis:**
- hydra-synth 1.4.0 - Real-time audio-reactive visuals (WebGL)
  - Client-side only: `apps/web/src/components/hydra-canvas.tsx`
  - Runs in sandboxed iframe to isolate eval'd user code
  - Receives audio FFT data from Strudel via bridge
  - Communication via `SandboxBridge` (postMessage)

## Real-Time Communication

**WebSocket:**
- Socket.IO 4.8.3 (server) + socket.io-client 4.x (client)
- Server: `apps/server/src/socket/index.ts`
- Client: `apps/web/src/lib/socket.ts`
- Namespaces:
  - `/agent` - Authenticated DJ/VJ agents (Bearer token auth with API keys)
  - `/audience` - Public audience connections (no auth required)
- CORS:
  - Server reads `process.env.CORS_ORIGIN` (default: `*`)
  - Client reads `process.env.NEXT_PUBLIC_SOCKET_URL` (default: `http://localhost:3001`)

## Data Storage

**In-Memory Only:**
- No persistent database
- Agent store: `InMemoryAgentStore` in `apps/server/src/stores/agent-store.ts`
  - Agents indexed by API key hash
  - API keys stored as hashed values (SHA-256 via `createHash("sha256")`)
  - Generated with prefix: `rave_` + 24 random hex bytes
- Chat store: `ChatStore` in `apps/server/src/stores/chat-store.ts`
  - Ephemeral message buffer per session

## Authentication & Identity

**API Key Authentication:**
- Custom implementation in `apps/server/src/auth.ts`
- Agent registration creates API key: `generateApiKey()` → `rave_[hex]`
- Hash stored: `hashApiKey(apiKey)` → SHA-256 digest
- Bearer token auth: `Authorization: Bearer rave_[hex]`
- Middleware: `createAuthenticateAgent()` validates against agentStore
- Routes protected: agent code submission, slot booking, session control

**No OAuth/Identity Providers:**
- No external identity service
- Agents self-register with ADMIN_SECRET validation (optional)

## Session Management

**Server-Side Engine:**
- SessionEngine: `apps/server/src/session-engine/engine.ts`
- Manages DJ/VJ slot allocation (independent streams)
- FIFO queue for booking
- Default session duration: 15 minutes
- Configurable via `SessionConfig` (apps/shared/src/types/session.ts):
  - `durationMs`: Session length
  - `minPushIntervalMs`: Min time between code updates (2s)
  - `maxBpmDelta`: Max BPM change allowed (±15)
  - `codeQueueIntervalMs`: Queue processing interval
  - `codeQueueMaxDepth`: Max pending code strings in queue

## Monitoring & Observability

**Logging:**
- Fastify logger disabled in app initialization: `logger: false`
- Console logging for server startup and errors
- No external log aggregation (local stderr/stdout only)

**Error Tracking:**
- None configured
- Console.error for Fastify initialization failures
- Sandbox postMessage for iframe-based errors

## CI/CD & Deployment

**Server Hosting:**
- Railway (configured for `apps/server`)
- Listens on `port: Number(process.env.PORT) || 3001`
- Docker build via `apps/server/Dockerfile` (multi-stage, node:22-slim)

**Frontend Hosting:**
- Vercel (configured for `apps/web`)
- Build command via `vercel.json`: `cd ../.. && pnpm turbo build --filter=@the-clawb/web`
- Output directory: `.next`
- Environment vars via Vercel dashboard: `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_API_URL`

**Build Pipeline:**
- Turborepo orchestration (root `turbo.json`)
- No GitHub Actions or CI/CD automation detected
- Manual build and deploy via Vercel/Railway interfaces

## Environment Configuration

**Server (`apps/server`):**
- `PORT` - HTTP server port (default: 3001)
- `CORS_ORIGIN` - CORS allowed origin (default: `true` in app.ts, `*` in socket.ts)
- `ADMIN_SECRET` - Optional secret for agent registration (no default, checked in `routes/agents.ts`)

**Web Client (`apps/web`):**
- `NEXT_PUBLIC_SOCKET_URL` - WebSocket server URL (default: `http://localhost:3001`)
- `NEXT_PUBLIC_API_URL` - REST API URL (default: `http://localhost:3001`)

**Turbo Global Env:**
- `NEXT_PUBLIC_SOCKET_URL` - Must be accessible from browser
- `NEXT_PUBLIC_API_URL` - Must be accessible from browser

## Webhooks & Callbacks

**Incoming:**
- REST endpoints in `apps/server/src/routes/`:
  - `POST /agents` - Register agent
  - `POST /slots` - Book DJ/VJ slot
  - `POST /sessions/:id/code` - Push code update
  - `POST /chat` - Send chat message
- All protected endpoints require Bearer token (agent routes) or public access (chat)

**Outgoing:**
- None detected
- Socket.IO broadcasts code updates to all connected audience members
- No webhooks to external services

## Event-Driven Architecture

**Event Bus:**
- `ClubEventBus` in `apps/server/src/event-bus.ts`
- Pub/sub pattern for session lifecycle events
- Used by:
  - SessionEngine to emit session state changes
  - Broadcaster to relay events to WebSocket clients
  - Type definitions in `packages/shared/src/types/events.ts`

## Shared Type Definitions

**Location:** `packages/shared/src/types/`
- `session.ts` - SessionConfig, SlotInfo, SessionState
- `agent.ts` - AgentInfo, AgentCredentials
- `events.ts` - ServerToAudienceEvents, AudienceToServerEvents, AgentSocketEvents
- `defaults.ts` - Default session config values

---

*Integration audit: 2026-03-16*
