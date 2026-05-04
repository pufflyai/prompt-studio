FROM oven/bun:1.3.13 AS builder

WORKDIR /app

COPY package.json bun.lock ./

# Copy the workspace manifests Bun needs.
COPY clients/landing-page/package.json clients/landing-page/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/pstdio-api/package.json packages/pstdio-api/package.json
COPY packages/pstdio-agents/package.json packages/pstdio-agents/package.json
COPY packages/pstdio-api-contracts/package.json packages/pstdio-api-contracts/package.json
COPY packages/pstdio-db/package.json packages/pstdio-db/package.json
COPY packages/pstdio-logging/package.json packages/pstdio-logging/package.json
COPY packages/pstdio-plugins/package.json packages/pstdio-plugins/package.json
COPY packages/pstdio-scheduler/package.json packages/pstdio-scheduler/package.json
COPY packages/pstdio-storage/package.json packages/pstdio-storage/package.json
COPY packages/pstdio-wt/package.json packages/pstdio-wt/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/e2e/package.json packages/e2e/package.json
COPY packages/pstdio-dashboard/package.json packages/pstdio-dashboard/package.json
COPY packages/pstdio/package.json packages/pstdio/package.json

RUN bun install \
  --filter './clients/landing-page' \
  --filter './packages/ui'

COPY tsconfig.base.json ./
COPY clients/landing-page clients/landing-page
COPY packages/ui packages/ui

RUN cd packages/ui && bun run build

RUN cd clients/landing-page && bun run build

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/clients/landing-page/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
