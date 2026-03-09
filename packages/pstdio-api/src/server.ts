import { createApp } from "./app";

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
  port,
});

console.log(`Server running on http://localhost:${port}`);
