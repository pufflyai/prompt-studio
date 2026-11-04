# The release producer supplies the already-verified compiled host through this named context.
FROM oven/bun:1.4.4 AS device
COPY --from=node:24.22.1-slim /usr/local/bin/node /usr/local/bin/node
USER root
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /opt/pstdio-defaults /home/bun/.pstdio \
  && chown -R bun:bun /opt/pstdio-defaults /home/bun
COPY --from=release --chmod=755 /pstdio /usr/local/bin/pstdio
COPY --chown=bun:bun packages/pstdio-api/files/extension-catalog.json /opt/device-catalog.json
COPY --chown=bun:bun infra/device/seed-defaults.ts /opt/seed-defaults.ts
USER bun
RUN bun /opt/seed-defaults.ts
USER root
RUN rm /opt/seed-defaults.ts /opt/device-catalog.json
COPY --chown=bun:bun infra/device/device-home.ts infra/device/entrypoint.ts /opt/pstdio-device/
ENV HOME=/home/bun PSTDIO_HOME=/home/bun/.pstdio
WORKDIR /home/bun
USER bun
VOLUME ["/home/bun"]
# Relay traffic is outbound. The native API stays on loopback and has no published port.
ENTRYPOINT ["bun", "/opt/pstdio-device/entrypoint.ts"]
