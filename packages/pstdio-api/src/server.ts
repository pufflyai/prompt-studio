import { apiWebSocket, createApp } from "./app";
import { resolveApiFilesRoot } from "./default-files-root";
import { disableExtensionMutationTimeout } from "./features/extensions/extension-request-timeout";
import { apiLogger } from "./lib/logger";

const port = Number(process.env.PORT ?? "19840");

const startServer = async () => {
  let close: (() => Promise<void>) | undefined;

  try {
    const appHandle = await createApp({
      filesRoot: resolveApiFilesRoot(),
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
      void appHandle.close();
      process.exit(1);
    });
    process.on("unhandledRejection", (err) => {
      apiLogger.error({ err, event: "api.unhandled_rejection" }, "API process caught an unhandled rejection");
      void appHandle.close();
      process.exit(1);
    });

    Bun.serve({
      fetch: (request, server) => {
        disableExtensionMutationTimeout(request, server);
        return app.fetch(request, server);
      },
      idleTimeout: 20,
      port,
      websocket: apiWebSocket,
    });

    apiLogger.info({ event: "api.server.started", port }, `Server running on http://localhost:${port}`);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    apiLogger.error({ err, event: "api.startup.error" }, "API process failed to start");
    await close?.();
    throw error;
  }
};

await startServer();
