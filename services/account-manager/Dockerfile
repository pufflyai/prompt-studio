FROM oven/bun:1.4.2 AS build
WORKDIR /build
COPY package.json bun.lock bunfig.toml ./
COPY services/telemetry/package.json ./services/telemetry/package.json
COPY services/account-manager/package.json ./services/account-manager/package.json
COPY packages/pstdio-sync-contracts/package.json ./packages/pstdio-sync-contracts/package.json
RUN bun install --frozen-lockfile --production --filter pstdio-account-manager
COPY services/account-manager/src ./services/account-manager/src
COPY services/telemetry/src ./services/telemetry/src
COPY packages/pstdio-sync-contracts/src ./packages/pstdio-sync-contracts/src
RUN bun build services/account-manager/src/server.ts services/account-manager/src/index.ts services/account-manager/src/environment-access.ts --target bun --outdir dist

FROM oven/bun:1.4.2-slim
WORKDIR /app
COPY --from=build --chown=bun:bun /build/dist ./dist
COPY --chown=bun:bun services/account-manager/drizzle ./drizzle
USER bun
EXPOSE 8443
CMD ["bun", "dist/server.js"]
