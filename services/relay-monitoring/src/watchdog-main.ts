import { z } from "zod";
import { addressSchema, environmentSchema, onShutdown, readBounded, readJson, schedule } from "./io";

const config = await readJson(
  process.env.MONITORING_CONFIG_FILE ?? "/run/secrets/watchdog.json",
  z
    .object({
      environment: environmentSchema,
      queryOrigin: addressSchema,
      readToken: z.string().min(32),
      watchdogUrl: z.url().refine((value) => new URL(value).protocol === "https:"),
    })
    .strict(),
);
const stop = schedule(async (signal) => {
  const health = await fetch(new URL("/health", config.queryOrigin), {
    headers: { authorization: `Bearer ${config.readToken}` },
    signal,
    redirect: "error",
  });
  if (!health.ok) {
    await health.body?.cancel();
    return;
  }
  z.object({
    environment: z.literal(config.environment),
    backends: z.object({ metrics: z.literal(true), logs: z.literal(true), alerts: z.literal(true) }),
  }).parse(JSON.parse(new TextDecoder().decode(await readBounded(health.body, undefined, signal))));
  const url = new URL("/prometheus/api/v1/query", config.queryOrigin);
  url.search = new URLSearchParams({
    query: `min(pstdio_relay:check_state{environment="${config.environment}",check="monitoring"})`,
  }).toString();
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${config.readToken}` },
    signal,
    redirect: "error",
  });
  if (!response.ok) {
    await response.body?.cancel();
    return;
  }
  const body = z
    .object({
      status: z.literal("success"),
      data: z.object({ result: z.array(z.object({ value: z.tuple([z.number(), z.literal("1")]) })).length(1) }),
    })
    .parse(JSON.parse(new TextDecoder().decode(await readBounded(response.body, undefined, signal))));
  if (!body.data.result.length) return;
  // The receiver alerts on a missed ping, including loss of this host or the monitoring backend.
  const ping = await fetch(config.watchdogUrl, { signal, redirect: "error" });
  await ping.body?.cancel();
}, 60_000);
onShutdown(stop);
