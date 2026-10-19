import { readRelayBackupConfig } from "./backup/config";
import { startRelayBackupService } from "./backup/service";

const service = await startRelayBackupService(readRelayBackupConfig(process.env));
async function shutdown() {
  process.off("SIGINT", shutdown);
  process.off("SIGTERM", shutdown);
  try {
    await service.close();
  } catch {
    console.error("Relay backup shutdown failed");
    process.exitCode = 1;
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
console.log(JSON.stringify({ event: "relay.backup.listening", url: service.server.url.href }));
