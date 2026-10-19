FROM oven/bun:1.4.2 AS build
WORKDIR /build
COPY package.json bun.lock bunfig.toml ./
COPY infra/relay/package.json ./infra/relay/package.json
COPY infra/account-manager/package.json ./infra/account-manager/package.json
COPY packages/pstdio-sync/package.json ./packages/pstdio-sync/package.json
COPY packages/pstdio-sync-contracts/package.json ./packages/pstdio-sync-contracts/package.json
RUN bun install --frozen-lockfile --production --filter pstdio-relay
COPY infra/relay/src ./infra/relay/src
COPY infra/relay/scripts ./infra/relay/scripts
COPY infra/account-manager/src ./infra/account-manager/src
COPY packages/pstdio-sync/src ./packages/pstdio-sync/src
COPY packages/pstdio-sync-contracts/src ./packages/pstdio-sync-contracts/src
RUN bun build infra/relay/src/server.ts infra/relay/src/backup-server.ts infra/relay/src/index.ts infra/relay/scripts/smoke.ts infra/relay/scripts/enroll-local.fixture.ts infra/relay/scripts/initialize.fixture.ts infra/relay/scripts/transport-client-smoke.ts infra/relay/scripts/recovery-key.fixture.ts --target bun --outdir dist

RUN bun build infra/account-manager/src/server.ts --target bun --outfile dist/manager.js

FROM oven/bun:1.4.2 AS tls-fixture
WORKDIR /app
COPY --chown=bun:bun infra/relay/scripts/tls.fixture.ts ./tls.fixture.ts
COPY --chown=bun:bun infra/relay/scripts/tls-validity.ts ./tls-validity.ts
COPY --chown=bun:bun infra/relay/scripts/tls-validity.test.ts ./tls-validity.test.ts
RUN mkdir /tls-private /tls-public /relay-tls-private && chown bun:bun /tls-private /tls-public /relay-tls-private
USER bun
CMD ["bun", "tls.fixture.ts"]

FROM oven/bun:1.4.2-slim AS base
WORKDIR /app
COPY --from=build --chown=bun:bun /build/dist/src/server.js ./server.js
COPY --from=build --chown=bun:bun /build/dist/src/backup-server.js ./backup-server.js
COPY --from=build --chown=bun:bun /build/dist/src/index.js ./storage.js
COPY --chown=bun:bun infra/relay/drizzle ./drizzle
ENV RELAY_HOST=0.0.0.0 RELAY_PORT=8080
USER bun
EXPOSE 8080
CMD ["bun", "server.js"]

FROM base AS smoke
COPY --from=build --chown=bun:bun /build/dist/scripts/smoke.js ./smoke.js
COPY --from=build --chown=bun:bun /build/dist/scripts/transport-client-smoke.js ./transport-client-smoke.js
CMD ["bun", "smoke.js"]

FROM base AS fixture
COPY --from=build --chown=bun:bun /build/dist/scripts/initialize.fixture.js ./initialize.js
COPY --from=build --chown=bun:bun /build/dist/scripts/enroll-local.fixture.js ./enroll-local.js
COPY --from=build --chown=bun:bun /build/dist/scripts/recovery-key.fixture.js ./recovery-key.js
COPY --from=build --chown=bun:bun /build/dist/manager.js ./manager.js
COPY --chown=bun:bun infra/account-manager/drizzle ./manager-drizzle
USER root
RUN mkdir /fixture /access-trust /recovery && chown bun:bun /fixture /access-trust /recovery
USER bun
CMD ["bun", "initialize.js"]

FROM base AS runtime
