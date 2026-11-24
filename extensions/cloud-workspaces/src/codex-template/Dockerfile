ARG WORKSPACE_IMAGE=pocketcoder-workspace:dev
FROM ${WORKSPACE_IMAGE}
USER root
RUN apk add --no-cache nodejs git libstdc++ libgcc
WORKDIR /opt/pstdio-tools
RUN bun add --exact pstdio@0.47.0-nightly.20261109030238 @openai/codex@0.167.0 \
  && printf '#!/bin/sh\nexec bun /opt/pstdio-tools/node_modules/pstdio/bin/pstdio.cjs "$@"\n' > /usr/local/bin/pst \
  && chmod 0755 /usr/local/bin/pst \
  && ln -s /opt/pstdio-tools/node_modules/.bin/codex /usr/local/bin/codex
COPY start.ts /opt/pstdio-tools/start.ts
RUN mkdir /work && chown 10001:10001 /work
WORKDIR /tmp
USER 10001:10001
ENV HOME=/work/home PSTDIO_HOME=/work/state
