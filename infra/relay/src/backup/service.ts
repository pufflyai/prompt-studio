import { createRelayBackupCatalog } from "./catalog";
import type { RelayBackupServiceConfig } from "./config";
import { createRelayBackupWorker } from "./worker";

export const startRelayBackupService = async (config: RelayBackupServiceConfig) => {
  const { hostname, port, ...backup } = config;
  const worker = createRelayBackupWorker(backup);
  const catalog = createRelayBackupCatalog(backup.backup);
  const shutdown = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closing = false;
  const run = async () => {
    let next = Date.now() + 60_000;
    try {
      next = await worker.tick();
      const status = await catalog.status(Date.now(), shutdown.signal);
      console.log(
        JSON.stringify({
          event: "relay.backup.status",
          state: status.state,
          capturedAt: status.backup?.capturedAt ?? null,
        }),
      );
    } catch (error) {
      if (!closing)
        console.error(
          JSON.stringify({
            event: "relay.backup.failed",
            message: error instanceof Error ? error.message : String(error),
          }),
        );
    } finally {
      if (!closing)
        timer = setTimeout(
          () => {
            pending = run();
          },
          Math.max(0, next - Date.now()),
        );
    }
  };
  let server: ReturnType<typeof Bun.serve>;
  try {
    server = Bun.serve({
      hostname,
      port,
      async fetch(request) {
        if (request.method !== "GET" || new URL(request.url).pathname !== "/health")
          return new Response("Not found", { status: 404 });
        try {
          const status = await catalog.status(Date.now(), request.signal);
          return Response.json(
            {
              state: status.state,
              capturedAt: status.backup?.capturedAt ?? null,
              error: status.status?.attempt?.error ?? null,
            },
            { status: status.state === "complete" ? 200 : 503 },
          );
        } catch {
          return Response.json({ state: "unavailable" }, { status: 503 });
        }
      },
    });
  } catch (error) {
    await worker.close();
    catalog.close();
    throw error;
  }
  let pending = run();
  return {
    server,
    async close() {
      closing = true;
      shutdown.abort(new Error("Backup service stopped"));
      clearTimeout(timer);
      const results = await Promise.allSettled([server.stop(true), worker.close()]);
      await pending;
      catalog.close();
      if (results.some((result) => result.status === "rejected")) throw new Error("Backup shutdown failed");
    },
  };
};
