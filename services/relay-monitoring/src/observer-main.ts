import { exportMetrics } from "./exporter";
import { onShutdown, readJson, schedule } from "./io";
import { createObserver, observerConfigSchema } from "./observer";

const file = process.env.MONITORING_CONFIG_FILE ?? "/run/secrets/observer.json";
const config = await readJson(file, observerConfigSchema);
config.databaseUrl = process.env.DATABASE_URL ?? config.databaseUrl;
const observer = createObserver(config);
const stop = schedule(async (signal) => {
  // Backup attestations can be refreshed by their owner without restarting the worker.
  config.backup = (await readJson(file, observerConfigSchema)).backup;
  await observer.collect(signal);
}, 15 * 60_000);
const stopExport = schedule((signal) => exportMetrics(observer.metrics, config.otlpEndpoint, signal), 30_000);
const server = Bun.serve({
  hostname: process.env.METRICS_HOST ?? "127.0.0.1",
  port: Number(process.env.METRICS_PORT ?? 9465),
  fetch: (request) =>
    request.method === "GET" && new URL(request.url).pathname === "/metrics"
      ? new Response(observer.metrics.render())
      : new Response(null, { status: 404 }),
});
onShutdown(async () => {
  await stop();
  await stopExport();
  await server.stop(true);
  await observer.close();
});
