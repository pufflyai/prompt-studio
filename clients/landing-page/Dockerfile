FROM oven/bun:1.3.13 AS builder

WORKDIR /app

# Copy the full workspace so every package.json declared in bun.lock is present.
COPY package.json bun.lock tsconfig.base.json ./
COPY packages packages
COPY clients clients
COPY extensions extensions
COPY scripts scripts

RUN bun install --frozen-lockfile --ignore-scripts

RUN cd packages/ui && bun run build
RUN cd clients/landing-page && bun run build

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/clients/landing-page/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
