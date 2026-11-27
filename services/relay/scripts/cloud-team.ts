// Runs the real relay transport/storage in the opt-in two-Cloud-workspace harness.

import { createRelayRuntime } from "../src/runtime";
import { startRelay } from "../src/service";
import { migrateRelayStorage } from "../src/storage/database";

const directory = "/workspace/cloud-team";
const config = await Bun.file(`${directory}/config.json`).json();
if (!new URL(config.databaseUrl).hostname.startsWith("ct-")) throw new Error("Expected owned disposable database");
const url = new URL(config.databaseUrl);
url.username = "relay";
url.password = config.controlToken;
url.pathname = "/relay";
await migrateRelayStorage(url.href, new URL("../drizzle/", import.meta.url).pathname);
const runtime = createRelayRuntime({
  DATABASE_URL: url.href,
  S3_BUCKET: "cloud-team",
  S3_ENDPOINT: config.objectEndpoint,
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: config.objectKey,
  S3_SECRET_ACCESS_KEY: config.objectSecret,
  RELAY_ACCESS_TRUST_FILE: `${directory}/trust.json`,
});
const server = startRelay(
  {
    hostname: "0.0.0.0",
    port: 8444,
    tls: { cert: Bun.file(`${directory}/ca.pem`), key: Bun.file(`${directory}/key.pem`) },
  },
  runtime,
);
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await server.stop(true);
  await runtime.close();
};
process.once("SIGTERM", () => {
  void close();
});
process.once("SIGINT", () => {
  void close();
});
console.log("Disposable real relay ready");
