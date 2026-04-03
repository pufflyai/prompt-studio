import { createApp } from "./app";
import { apiLogger } from "./lib/logger";

const { app, close } = await createApp();
const port = Number(process.env.PORT ?? "19840");

const shutdown = async () => {
  await close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

Bun.serve({
  fetch: app.fetch,
  idleTimeout: 20,
  port,
});

apiLogger.info({ event: "api.server.started", port }, `Server running on http://localhost:${port}`);
