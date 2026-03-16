# Technology Stack

**Analysis Date:** 2026-03-16

## Languages

**Primary:**
- TypeScript 5.x - Used across entire monorepo (server, web, shared, types)

**Secondary:**
- JavaScript - Build configs, some configuration files
- HTML/CSS - Web frontend (Tailwind CSS v4 via PostCSS)

## Runtime

**Environment:**
- Node.js 22 (specified in `.nvmrc`)
- Browser (ES2022+ target for browsers, ES2017 for Next.js)

**Package Manager:**
- pnpm 9.15.0 (via `packageManager` field in `package.json`)
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- Fastify 5.x - HTTP server framework (apps/server)
- Next.js 15.x - React metaframework with built-in routing (apps/web)
- React 19.x - UI component library (apps/web)
- Turborepo 2.x - Monorepo task orchestration and build system

**Build/Dev:**
- Vite 7.x - Build tool (transitive via vitest)
- tsx 4.x - TypeScript executor for Node.js development
- PostCSS 4.x - CSS processing pipeline (Tailwind integration)
- tsc (TypeScript Compiler) - Type checking and transpilation

**Testing:**
- Vitest 3.x - Unit/integration test runner
- Chai 5.x - Assertion library

## Key Dependencies

**Critical:**
- Socket.IO 4.8.3 - Real-time bidirectional communication
  - Server: `socket.io` (apps/server)
  - Client: `socket.io-client` 4.x (apps/web)
- @strudel/web 1.3.0 - Live coding music synthesis library (AGPL-3.0)
- hydra-synth 1.4.0 - Real-time visual synthesis (WebGL)

**Infrastructure:**
- @fastify/cors 11.x - CORS middleware for Fastify
- @fastify/rate-limit 10.3.0 - Rate limiting middleware
- Pino 10.3.1 - Structured JSON logging (transitive via Fastify)
- react-resizable-panels 4.7.2 - Draggable layout panels for dashboard

**Styling:**
- @tailwindcss/postcss 4.x - Tailwind CSS v4 via PostCSS
- Tailwind CSS 4.x - Utility-first CSS framework

## Monorepo Structure

**Workspace:**
- Location: Root `package.json` with `packageManager: pnpm@9.15.0`
- Workspaces defined in `pnpm-workspace.yaml`:
  - `apps/*` - Application packages (server, web)
  - `packages/*` - Shared libraries (shared types)
  - `skill/*` - Skill definition packages

**Packages:**
- `@the-clawb/server` - Fastify HTTP + Socket.IO server
- `@the-clawb/web` - Next.js 15 client application
- `@the-clawb/shared` - Shared TypeScript types and utilities

## Configuration

**TypeScript:**
- Base config: `tsconfig.base.json` (strict mode, ES2022 target, ESNext module, bundler moduleResolution)
- Server extends base: `apps/server/tsconfig.json` (outDir: dist, rootDir: src, vitest globals)
- Web overrides: `apps/web/tsconfig.json` (target: ES2017, JSX: preserve, path alias @/*)
- Shared extends base: `packages/shared/tsconfig.json` (outDir: dist, rootDir: src)

**Build:**
- Turbo config: `turbo.json`
  - Global env vars: `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_API_URL`
  - Task pipeline: build (depends on ^build), dev, test, lint

**Next.js:**
- Config: `apps/web/next.config.ts`
  - Transpiles `@the-clawb/shared`
  - Vercel deployment configured via `vercel.json`

**Strudel/Hydra:**
- Type definitions: `apps/web/src/types/strudel-web.d.ts`, `apps/web/src/types/hydra-synth.d.ts`
- Both run in sandboxed iframes for security and audio context isolation

## Docker

**Build:**
- Location: `apps/server/Dockerfile`
- Multi-stage: base (node:22-slim), build stage, runtime stage
- Corepack enabled for pnpm support
- Production image runs `node apps/server/dist/index.js` on port 3001

## Platform Requirements

**Development:**
- Node.js 22.x
- pnpm 9.15.0
- Git (monorepo operations)

**Production:**
- Node.js 22-slim Docker image (Railway deployment)
- Fastify server listens on port 3001 (default) or `process.env.PORT`
- Next.js frontend deployed on Vercel (separate deployment from server)

---

*Stack analysis: 2026-03-16*
