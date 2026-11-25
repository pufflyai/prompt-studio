import { onShutdown, readJson, schedule } from "./io";
import { createProbe } from "./probe";
import { probeConfigSchema } from "./probe-config";

const config = await readJson(process.env.MONITORING_CONFIG_FILE ?? "/run/secrets/probe.json", probeConfigSchema);
const probe = await createProbe(config);
const stop = schedule(probe.run, 5 * 60_000);
const server = Bun.serve({
  hostname: process.env.METRICS_HOST ?? "127.0.0.1",
  port: Number(process.env.METRICS_PORT ?? 9466),
  fetch: (request) =>
    request.method === "GET" && new URL(request.url).pathname === "/metrics"
      ? new Response(probe.metrics.render())
      : new Response(null, { status: 404 }),
});
onShutdown(async () => {
  await stop();
  await server.stop(true);
});
