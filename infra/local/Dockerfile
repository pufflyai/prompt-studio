FROM oven/bun:1.3.11

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.bun/bin:/root/.local/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl git ripgrep unzip \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /root/.local/bin
RUN bun add -g opencode-ai@1.4.6
RUN ln -sf /usr/local/bin/bun /usr/local/bin/node
RUN ln -sf /root/.bun/install/global/node_modules/opencode-ai/bin/opencode /root/.local/bin/opencode
RUN ln -sf /root/.bun/install/global/node_modules/opencode-ai/bin/opencode /usr/local/bin/opencode
RUN curl -fsSL https://claude.ai/install.sh | bash
RUN ln -sf /root/.local/bin/claude /usr/local/bin/claude

WORKDIR /workspace

RUN opencode --version && claude --version
