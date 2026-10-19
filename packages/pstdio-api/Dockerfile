FROM oven/bun:1.4.2 AS source

WORKDIR /app

# Copy the full workspace so every package.json declared in bun.lock is present.
# Bun follows each target's workspace dependencies from the lockfile.
COPY package.json bun.lock bunfig.toml .npmrc tsconfig.base.json ./
COPY packages packages
COPY clients clients
COPY extensions extensions
COPY infra/local/extensions infra/local/extensions
COPY infra/relay/package.json infra/relay/package.json
COPY infra/account-manager/package.json infra/account-manager/package.json
COPY infra/telemetry/package.json infra/telemetry/package.json
COPY .pstdio/extensions .pstdio/extensions
COPY scripts scripts

FROM source AS sdk

RUN bun install --frozen-lockfile --ignore-scripts --filter @pstdio/sdk
RUN bun run --cwd packages/sdk build:js

FROM source AS deps

RUN bun install --frozen-lockfile --ignore-scripts --production --filter pstdio-api
COPY --from=sdk /app/packages/sdk/dist /app/packages/sdk/dist


FROM oven/bun:1.4.2-slim AS runner

WORKDIR /app

COPY --from=deps /app /app

WORKDIR /app/packages/pstdio-api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
