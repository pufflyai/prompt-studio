FROM oven/bun:1.4.4 AS build
WORKDIR /source
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --cwd services/cloud-access build

FROM oven/bun:1.4.4-slim
WORKDIR /app
COPY --from=build /source/services/cloud-access/dist/server.js /app/server.js
USER bun
ENV HOST=0.0.0.0 PORT=8090
EXPOSE 8090
CMD ["bun", "/app/server.js"]
