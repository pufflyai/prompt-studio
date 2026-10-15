FROM oven/bun:1.4.2 AS build
WORKDIR /build
COPY infra/relay/src/service.ts infra/relay/src/server.ts ./src/
COPY infra/relay/scripts/smoke.ts ./scripts/smoke.ts
RUN bun build src/server.ts scripts/smoke.ts --target bun --outdir dist

FROM oven/bun:1.4.2-slim AS base
WORKDIR /app
COPY --from=build --chown=bun:bun /build/dist/src/server.js ./server.js
ENV RELAY_HOST=0.0.0.0 RELAY_PORT=8080
USER bun
EXPOSE 8080
CMD ["bun", "server.js"]

FROM base AS smoke
COPY --from=build --chown=bun:bun /build/dist/scripts/smoke.js ./smoke.js
CMD ["bun", "smoke.js"]

FROM base AS runtime
