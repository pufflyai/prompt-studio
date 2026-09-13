FROM oven/bun:1.3.14

COPY --from=node:24.19.0-slim /usr/local/bin/node /usr/local/bin/node

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/home/bun/.local/bin:/opt/bun/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl git ripgrep unzip \
  && rm -rf /var/lib/apt/lists/*

RUN BUN_INSTALL=/opt/bun bun add -g opencode-ai@1.15.5 @openai/codex@0.139.0
RUN ln -sf /opt/bun/install/global/node_modules/opencode-ai/bin/opencode.exe /usr/local/bin/opencode
RUN ln -sf /opt/bun/install/global/node_modules/@openai/codex/bin/codex.js /usr/local/bin/codex

ARG HOST_UID=1000
ARG HOST_GID=1000
ARG CONTAINER_WORKTREE=/workspace/prompt-studio

# Bind mounts preserve numeric ownership. Prepare volume roots before Docker copies them.
RUN test "$HOST_UID" -ne 0 \
  && (getent group "$HOST_GID" || groupadd --gid "$HOST_GID" pstdio) \
  && usermod --uid "$HOST_UID" --gid "$HOST_GID" bun \
  && mkdir -p "$CONTAINER_WORKTREE/node_modules" /workspace/project \
    /home/bun/.bun/install/cache /home/bun/.local/bin /home/bun/.local/share/opencode \
    /home/bun/.config/opencode /home/bun/.claude /home/bun/.codex \
  && chown -R "$HOST_UID:$HOST_GID" /home/bun /workspace/project "$CONTAINER_WORKTREE/node_modules"

ENV HOME=/home/bun
USER bun

RUN curl -fsSL https://claude.ai/install.sh | bash

WORKDIR /workspace

RUN opencode --version && claude --version && codex --version
