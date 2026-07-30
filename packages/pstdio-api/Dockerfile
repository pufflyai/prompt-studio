FROM oven/bun:1.3.13 AS deps

WORKDIR /app

# Copy the full workspace so every package.json declared in bun.lock is present.
# Avoids drift when packages are added: no per-package COPY/--filter lists to maintain.
COPY package.json bun.lock tsconfig.base.json ./
COPY packages packages
COPY clients clients
COPY extensions extensions
COPY .pstdio/extensions/pstdio-planner-loops/package.json .pstdio/extensions/pstdio-planner-loops/package.json
COPY scripts scripts

RUN bun install --frozen-lockfile --ignore-scripts --production


FROM oven/bun:1.3.13-slim AS runner

WORKDIR /app

COPY --from=deps /app /app

WORKDIR /app/packages/pstdio-api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "src/server.ts"]
