import { apiWebSocket, assertListenHostAllowed, closeBeforeFatalExit, createApp, resolveAppConfig } from "./app";
import { disableExtensionMutationTimeout } from "./features/extensions/extension-request-timeout";
import { apiLogger } from "./lib/logger";

const port = Number(process.env.PORT ?? "19840");
const hostname = process.env.PSTDIO_API_HOST ?? "127.0.0.1";

const startServer = async () => {
  let close: (() => Promise<void>) | undefined;

  try {
    assertListenHostAllowed(hostname, process.env.PSTDIO_API_TOKEN);
    const appHandle = await createApp({
      config: resolveAppConfig({ env: process.env }),
      host: { kind: "standalone", token: process.env.PSTDIO_API_TOKEN },
    });
    const { app } = appHandle;
    close = appHandle.close;
    let shutdownPromise: Promise<void> | null = null;

    const shutdown = (code = 0) => {
      shutdownPromise ??= appHandle.close().finally(() => {
        process.exit(code);
      });
      return shutdownPromise;
    };

    process.on("SIGINT", () => void shutdown(0));
    process.on("SIGTERM", () => void shutdown(0));
    process.on("uncaughtException", (err) => {
      apiLogger.error({ err, event: "api.uncaught_exception" }, "API process caught an uncaught exception");
      void closeBeforeFatalExit(appHandle.close).then(() => process.exit(1));
    });
    process.on("unhandledRejection", (err) => {
      apiLogger.error({ err, event: "api.unhandled_rejection" }, "API process caught an unhandled rejection");
      void closeBeforeFatalExit(appHandle.close).then(() => process.exit(1));
    });

    Bun.serve({
      fetch: (request, server) => {
        disableExtensionMutationTimeout(request, server);
        return app.fetch(request, server);
      },
      hostname,
      idleTimeout: 20,
      port,
      websocket: apiWebSocket,
    });

    apiLogger.info({ event: "api.server.started", hostname, port }, `Server running on http://${hostname}:${port}`);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    apiLogger.error({ err, event: "api.startup.error" }, "API process failed to start");
    await close?.();
    throw error;
  }
};

await startServer();
