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
RUN pnpm --filter @the-clawb/shared build && pnpm --filter @the-clawb/server build

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/server/node_modules apps/server/node_modules
COPY --from=build /app/apps/server/package.json apps/server/package.json
COPY --from=build /app/packages/shared packages/shared
EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
