import { createRelayHandler } from "./transport/http";
import type { RelayOwners } from "./transport/owners";
import type { RelaySubscription } from "./transport/subscriptions";

export interface RelayConfig {
  hostname: string;
  port: number;
}

export function readConfig(env: Record<string, string | undefined>) {
  const port = Number(env.RELAY_PORT ?? "8080");
  if (env.RELAY_PORT === "" || !Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("RELAY_PORT must be an integer between 0 and 65535");
  }
  return { hostname: env.RELAY_HOST ?? "127.0.0.1", port };
}

export function startRelay(config: RelayConfig, owners: RelayOwners) {
  const handler = createRelayHandler(owners, (request, data) => server.upgrade(request, { data }));
  const server = Bun.serve<RelaySubscription>({
    ...config,
    // Match the existing S3 maximum part size while forwarding the body as a bounded stream.
    maxRequestBodySize: 5 * 1024 ** 3,
    fetch: handler,
    websocket: {
      open(socket) {
        socket.data.open(socket);
      },
      message(socket) {
        socket.data.close(1008);
      },
      close(socket) {
        socket.data.close();
      },
    },
  });
  return server;
}
