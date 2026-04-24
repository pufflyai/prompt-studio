import { createApp } from "./app";

const { app, close } = await createApp({
  filesRoot: process.env.PSTDIO_FILES_ROOT ?? "",
  schedulerTickMs: 60_000,
});

const shutdown = async () => {
  await close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default {
  fetch: app.fetch,
};
