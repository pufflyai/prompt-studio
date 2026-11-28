# Extend an operator-approved, digest-pinned PocketCoder test runtime.
ARG WORKSPACE_IMAGE
FROM ${WORKSPACE_IMAGE} AS build
USER root
COPY extensions/remote-testing/runtime /src/runtime
RUN bun build /src/runtime/runner.ts --target bun --outfile /out/test-runner.js

FROM ${WORKSPACE_IMAGE}
USER root
# Docker CLI and Compose must match the approved daemon's major version.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
  && . /etc/os-release \
  && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list \
  && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin docker-buildx-plugin \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/test-runner.js /opt/pocketcoder/test-runner.js
USER 10001:10001
