import { readConfig, startRelay } from "./service";

const server = startRelay(readConfig(process.env));

async function shutdown() {
  process.off("SIGTERM", shutdown);
  process.off("SIGINT", shutdown);
  await server.stop();
  console.log("Relay stopped");
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
console.log(`Relay listening at ${server.url}`);
