FROM oven/bun:1.4.2 AS build
WORKDIR /build
COPY package.json bun.lock bunfig.toml ./
COPY infra/telemetry/package.json ./infra/telemetry/package.json
COPY infra/account-manager/package.json ./infra/account-manager/package.json
COPY packages/pstdio-sync-contracts/package.json ./packages/pstdio-sync-contracts/package.json
RUN bun install --frozen-lockfile --production --filter pstdio-account-manager
COPY infra/account-manager/src ./infra/account-manager/src
COPY infra/telemetry/src ./infra/telemetry/src
COPY packages/pstdio-sync-contracts/src ./packages/pstdio-sync-contracts/src
RUN bun build infra/account-manager/src/server.ts infra/account-manager/src/index.ts infra/account-manager/src/environment-access.ts --target bun --outdir dist

FROM oven/bun:1.4.2-slim
WORKDIR /app
COPY --from=build --chown=bun:bun /build/dist ./dist
COPY --chown=bun:bun infra/account-manager/drizzle ./drizzle
USER bun
EXPOSE 8443
CMD ["bun", "dist/server.js"]
