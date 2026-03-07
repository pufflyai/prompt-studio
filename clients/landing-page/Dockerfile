FROM oven/bun:1.3.10 AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY clients/landing-page/package.json clients/landing-page/package.json
COPY packages/e2e/package.json packages/e2e/package.json
COPY packages/pstdio/package.json packages/pstdio/package.json
COPY packages/pstdio-agents/package.json packages/pstdio-agents/package.json
COPY packages/pstdio-api/package.json packages/pstdio-api/package.json
COPY packages/pstdio-dashboard/package.json packages/pstdio-dashboard/package.json
COPY packages/pstdio-db/package.json packages/pstdio-db/package.json
COPY packages/pstdio-storage/package.json packages/pstdio-storage/package.json
COPY packages/pstdio-wt/package.json packages/pstdio-wt/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates nodejs python3 make g++ \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN bun install \
  --filter './clients/landing-page' \
  --filter './packages/ui'

COPY tsconfig.base.json ./
COPY clients/landing-page clients/landing-page
COPY packages/ui packages/ui

RUN cd packages/ui && bun run build

RUN cd clients/landing-page && /usr/bin/node node_modules/gatsby/dist/bin/gatsby.js build

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/clients/landing-page/public /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
