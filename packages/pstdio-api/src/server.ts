import { createApp } from "./app";

const app = await createApp();
const port = Number(process.env.PORT ?? "19840");

Bun.serve({
  fetch: app.fetch,
  port,
});

console.log(`Server running on http://localhost:${port}`);
