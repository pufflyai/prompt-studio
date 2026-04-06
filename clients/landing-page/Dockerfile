FROM oven/bun:1.3.10 AS builder

WORKDIR /app

COPY package.json bun.lock ./

# Copy the workspace manifests Bun needs.
COPY clients/landing-page/package.json clients/landing-page/package.json
COPY packages/ui/package.json packages/ui/package.json

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
