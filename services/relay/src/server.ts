import { createServiceTelemetry } from "pstdio-service-telemetry";
import { createRelayRuntime } from "./runtime";
import { readConfig, startRelay } from "./service";

const telemetry = createServiceTelemetry(process.env, "relay");
const runtime = createRelayRuntime(process.env);
const server = startRelay(readConfig(process.env), runtime, telemetry.report);

async function shutdown() {
  process.off("SIGTERM", shutdown);
  process.off("SIGINT", shutdown);
  const results = await Promise.allSettled([server.stop(true), runtime.close()]);
  telemetry.close();
  console.log(JSON.stringify({ event: "telemetry.delivery", service: "relay", ...telemetry.counts() }));
  if (results.some((result) => result.status === "rejected")) {
    console.error("Relay shutdown failed");
    process.exitCode = 1;
    return;
  }
  console.log("Relay stopped");
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
console.log(`Relay listening at ${server.url}`);
