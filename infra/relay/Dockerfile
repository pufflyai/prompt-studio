FROM oven/bun:1.4.2 AS build
WORKDIR /build
COPY package.json bun.lock bunfig.toml ./
COPY infra/relay/package.json ./infra/relay/package.json
COPY packages/pstdio-sync/package.json ./packages/pstdio-sync/package.json
COPY packages/pstdio-sync-contracts/package.json ./packages/pstdio-sync-contracts/package.json
RUN bun install --frozen-lockfile --production --filter pstdio-relay
COPY infra/relay/src ./infra/relay/src
COPY infra/relay/scripts/smoke.ts ./infra/relay/scripts/smoke.ts
COPY packages/pstdio-sync/src ./packages/pstdio-sync/src
COPY packages/pstdio-sync-contracts/src ./packages/pstdio-sync-contracts/src
RUN bun build infra/relay/src/server.ts infra/relay/src/index.ts infra/relay/scripts/smoke.ts --target bun --outdir dist

FROM oven/bun:1.4.2-slim AS base
WORKDIR /app
COPY --from=build --chown=bun:bun /build/dist/src/server.js ./server.js
COPY --from=build --chown=bun:bun /build/dist/src/index.js ./storage.js
COPY --chown=bun:bun infra/relay/drizzle ./drizzle
ENV RELAY_HOST=0.0.0.0 RELAY_PORT=8080
USER bun
EXPOSE 8080
CMD ["bun", "server.js"]

FROM base AS smoke
COPY --from=build --chown=bun:bun /build/dist/scripts/smoke.js ./smoke.js
CMD ["bun", "smoke.js"]

FROM base AS runtime
