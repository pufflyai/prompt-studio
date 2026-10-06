import { apiWebSocket, assertListenHostAllowed, closeBeforeFatalExit, createApp, resolveAppConfig } from "./app";
import { disableExtensionMutationTimeout } from "./features/extensions/extension-request-timeout";
import { apiLogger } from "./lib/logger";

const hostname = process.env.PSTDIO_API_HOST ?? "127.0.0.1";
assertListenHostAllowed(hostname, process.env.PSTDIO_API_TOKEN);

const { app, close } = await createApp({
  config: resolveAppConfig({ env: process.env }),
  host: { kind: "standalone", token: process.env.PSTDIO_API_TOKEN },
});

let shutdownPromise: Promise<void> | null = null;

const shutdown = (code = 0) => {
  shutdownPromise ??= close().finally(() => {
    process.exit(code);
  });
  return shutdownPromise;
};

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
process.on("uncaughtException", (err) => {
  apiLogger.error({ err, event: "api.uncaught_exception" }, "API process caught an uncaught exception");
  void closeBeforeFatalExit(close).then(() => process.exit(1));
});
process.on("unhandledRejection", (err) => {
  apiLogger.error({ err, event: "api.unhandled_rejection" }, "API process caught an unhandled rejection");
  void closeBeforeFatalExit(close).then(() => process.exit(1));
});

export default {
  fetch(request: Request, server: Bun.Server<unknown>) {
    disableExtensionMutationTimeout(request, server);
    return app.fetch(request, server);
  },
  hostname,
  websocket: apiWebSocket,
};
