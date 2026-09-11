FROM oven/bun:1.3.14 AS source

WORKDIR /app

# Copy the full workspace so every package.json declared in bun.lock is present.
# Bun follows each target's workspace dependencies from the lockfile.
COPY package.json bun.lock tsconfig.base.json ./
COPY patches patches
COPY packages packages
COPY clients clients
COPY extensions extensions
COPY infra/local/extensions infra/local/extensions
COPY .pstdio/extensions/font-editor/package.json .pstdio/extensions/font-editor/package.json
COPY .pstdio/extensions/pstdio-dev/package.json .pstdio/extensions/pstdio-dev/package.json
COPY .pstdio/extensions/pstdio-planner-loops/package.json .pstdio/extensions/pstdio-planner-loops/package.json
COPY scripts scripts

FROM source AS sdk

RUN bun install --frozen-lockfile --ignore-scripts --filter @pstdio/sdk
RUN bun run --cwd packages/sdk build:js

FROM source AS deps

RUN bun install --frozen-lockfile --ignore-scripts --production --filter pstdio-api
COPY --from=sdk /app/packages/sdk/dist /app/packages/sdk/dist


FROM oven/bun:1.3.14-slim AS runner

WORKDIR /app

COPY --from=deps /app /app

WORKDIR /app/packages/pstdio-api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
