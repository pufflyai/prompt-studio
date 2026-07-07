import { createApp } from "./app";
import { resolveApiFilesRoot } from "./default-files-root";
import { apiLogger } from "./lib/logger";

const { app, close } = await createApp({
  filesRoot: resolveApiFilesRoot(),
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
  void close();
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  apiLogger.error({ err, event: "api.unhandled_rejection" }, "API process caught an unhandled rejection");
  void close();
  process.exit(1);
});

export default {
  fetch: app.fetch,
};
