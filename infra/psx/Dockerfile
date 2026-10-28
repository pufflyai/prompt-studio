FROM oven/bun:1.4.4 AS build
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --cwd services/psx build
RUN bun build services/account-manager/scripts/database-migration.ts --target bun --outfile services/psx/dist/database-migration.js
RUN bun build infra/container-entrypoint.ts --target bun --outfile /entrypoint.js

FROM oven/bun:1.4.4-slim
WORKDIR /app
COPY --from=build /repo/services/psx/dist ./dist
COPY --from=build /repo/services/psx/drizzle ./drizzle
COPY --from=build /entrypoint.js ./container-entrypoint.ts
USER bun
EXPOSE 8080
CMD ["bun", "container-entrypoint.ts", "bun", "dist/server.js"]
