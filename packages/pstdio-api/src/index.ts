import { createApp } from "./app";
import { resolveApiFilesRoot } from "./default-files-root";

const { app, close } = await createApp({
  filesRoot: resolveApiFilesRoot(),
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
