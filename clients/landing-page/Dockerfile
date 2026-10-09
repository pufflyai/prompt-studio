FROM node:24-bookworm-slim AS builder

COPY --from=oven/bun:1.4.2 /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app

# Copy the full workspace so every package.json declared in bun.lock is present.
COPY package.json bun.lock tsconfig.base.json ./
COPY packages packages
COPY clients clients
COPY extensions extensions
COPY infra/local/extensions infra/local/extensions
COPY .pstdio/extensions/font-editor/package.json .pstdio/extensions/font-editor/package.json
COPY .pstdio/extensions/pstdio-dev/package.json .pstdio/extensions/pstdio-dev/package.json
COPY scripts scripts
# The docs pages are built from the repo's documentation and extension READMEs.
COPY documentation documentation
COPY design/art design/art

# @pstdio/ui imports @pstdio/sdk/extensions at runtime, so the SDK is built before ui.
RUN bun install --frozen-lockfile --ignore-scripts --filter @pstdio/sdk
RUN bun run --cwd packages/sdk build:js
RUN bun install --frozen-lockfile --ignore-scripts --filter @pstdio/landing-page

RUN cd packages/ui && bun run build
RUN cd clients/landing-page && bun run build

FROM nginx:1.27-alpine AS runner

COPY clients/landing-page/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/clients/landing-page/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
