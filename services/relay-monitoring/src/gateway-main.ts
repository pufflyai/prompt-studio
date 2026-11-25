import { z } from "zod";
import { createMonitoringGateway } from "./gateway";
import { addressSchema, environmentSchema, onShutdown, readJson } from "./io";

const token = z.string().min(32).max(512);
const config = await readJson(
  process.env.MONITORING_GATEWAY_SECRETS_FILE ?? "/run/secrets/gateway.json",
  z.strictObject({
    readToken: token,
    metricsToken: token,
    logsToken: token,
    environment: environmentSchema,
    metricsOrigin: addressSchema.default("http://prometheus:9090"),
    logsOrigin: addressSchema.default("http://loki:3100"),
    alertsOrigin: addressSchema.default("http://alertmanager:9093"),
  }),
);
const server = Bun.serve({
  hostname: "0.0.0.0",
  port: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .parse(process.env.GATEWAY_PORT ?? 8080),
  maxRequestBodySize: 2 * 1024 ** 2,
  fetch: createMonitoringGateway(config),
});
onShutdown(() => server.stop(true));
