FROM oven/bun:1.3.13

WORKDIR /app

# Copy dependency manifests first for a cacheable, reproducible install layer.
COPY package.json bun.lock ./
# Copy the workspace manifests Bun needs.
COPY packages/pstdio-api/package.json packages/pstdio-api/package.json
COPY packages/pstdio-agents/package.json packages/pstdio-agents/package.json
COPY packages/pstdio-api-contracts/package.json packages/pstdio-api-contracts/package.json
COPY packages/pstdio-db/package.json packages/pstdio-db/package.json
COPY packages/pstdio-logging/package.json packages/pstdio-logging/package.json
COPY packages/pstdio-plugins/package.json packages/pstdio-plugins/package.json
COPY packages/pstdio-storage/package.json packages/pstdio-storage/package.json
COPY packages/pstdio-wt/package.json packages/pstdio-wt/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/e2e/package.json packages/e2e/package.json
COPY packages/pstdio-dashboard/package.json packages/pstdio-dashboard/package.json
COPY packages/pstdio/package.json packages/pstdio/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY clients/landing-page/package.json clients/landing-page/package.json

RUN bun install --frozen-lockfile --ignore-scripts \
  --filter './packages/pstdio-api' \
  --filter './packages/pstdio-agents' \
  --filter './packages/pstdio-db' \
  --filter './packages/pstdio-storage'

# Copy source after install so code changes do not bust the dependency cache.
COPY tsconfig.base.json ./
COPY packages/pstdio-api packages/pstdio-api
COPY packages/pstdio-agents packages/pstdio-agents
COPY packages/pstdio-db packages/pstdio-db
COPY packages/pstdio-storage packages/pstdio-storage

WORKDIR /app/packages/pstdio-api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
