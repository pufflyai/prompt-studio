FROM oven/bun:1.4.4 AS build
WORKDIR /build
COPY package.json bun.lock bunfig.toml ./
COPY services/telemetry/package.json ./services/telemetry/package.json
COPY services/relay/package.json ./services/relay/package.json
COPY services/account-manager/package.json ./services/account-manager/package.json
COPY packages/pstdio-sync/package.json ./packages/pstdio-sync/package.json
COPY packages/pstdio-sync-contracts/package.json ./packages/pstdio-sync-contracts/package.json
# The relay benchmark's writer is a development dependency; the production install skips it but needs its manifest.
COPY packages/benchmarks/package.json ./packages/benchmarks/package.json
COPY packages/storage-scale-fixture/package.json ./packages/storage-scale-fixture/package.json
RUN bun install --frozen-lockfile --production --filter pstdio-relay
COPY services/relay/src ./services/relay/src
COPY services/relay/scripts ./services/relay/scripts
COPY services/account-manager/src ./services/account-manager/src
COPY services/telemetry/src ./services/telemetry/src
COPY packages/pstdio-sync/src ./packages/pstdio-sync/src
COPY packages/pstdio-sync-contracts/src ./packages/pstdio-sync-contracts/src
COPY services/account-manager/scripts/database-migration.ts ./services/relay/database-migration.ts
RUN bun build services/relay/database-migration.ts --target bun --outfile dist/database-migration.js
RUN bun build services/relay/src/server.ts services/relay/src/index.ts services/relay/scripts/smoke.ts services/relay/scripts/smoke-replacement.ts services/relay/scripts/enroll-local.fixture.ts services/relay/scripts/initialize.fixture.ts services/relay/scripts/transport-client-smoke.ts services/relay/scripts/recovery-key.fixture.ts --target bun --outdir dist

RUN bun build services/account-manager/src/server.ts --target bun --outfile dist/manager.js

FROM oven/bun:1.4.4 AS tls-fixture
WORKDIR /app
COPY --chown=bun:bun services/relay/scripts/tls.fixture.ts ./tls.fixture.ts
COPY --chown=bun:bun services/relay/scripts/tls-validity.ts ./tls-validity.ts
COPY --chown=bun:bun services/relay/scripts/tls-validity.p0.test.ts ./tls-validity.p0.test.ts
RUN mkdir /tls-private /tls-public /relay-tls-private && chown bun:bun /tls-private /tls-public /relay-tls-private
USER bun
CMD ["bun", "tls.fixture.ts"]

FROM oven/bun:1.4.4-slim AS base
WORKDIR /app
COPY --from=build --chown=bun:bun /build/dist/src/server.js ./server.js
COPY --from=build --chown=bun:bun /build/dist/src/index.js ./storage.js
COPY --from=build --chown=bun:bun /build/dist/database-migration.js ./database-migration.js
COPY --chown=bun:bun infra/container-entrypoint.ts ./container-entrypoint.ts
COPY --chown=bun:bun services/relay/drizzle ./drizzle
ENV RELAY_HOST=0.0.0.0 RELAY_PORT=8080
USER bun
EXPOSE 8080
CMD ["bun", "container-entrypoint.ts", "bun", "server.js"]

FROM base AS smoke
COPY --from=build --chown=bun:bun /build/dist/scripts/smoke.js ./smoke.js
COPY --from=build --chown=bun:bun /build/dist/scripts/smoke-replacement.js ./smoke-replacement.js
COPY --from=build --chown=bun:bun /build/dist/scripts/transport-client-smoke.js ./transport-client-smoke.js
CMD ["bun", "smoke.js"]

FROM base AS fixture
COPY --from=build --chown=bun:bun /build/dist/scripts/initialize.fixture.js ./initialize.js
COPY --from=build --chown=bun:bun /build/dist/scripts/enroll-local.fixture.js ./enroll-local.js
COPY --from=build --chown=bun:bun /build/dist/scripts/recovery-key.fixture.js ./recovery-key.js
COPY --from=build --chown=bun:bun /build/dist/manager.js ./manager.js
COPY --chown=bun:bun services/account-manager/drizzle ./manager-drizzle
USER root
RUN mkdir /fixture /access-trust /recovery && chown bun:bun /fixture /access-trust /recovery
USER bun
CMD ["bun", "initialize.js"]

FROM base AS runtime
