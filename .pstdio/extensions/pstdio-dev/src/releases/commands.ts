import { defineCommand, eventRef } from "@pstdio/sdk/extensions";
import { readHealth, syncHealth } from "./history";

export const healthChanged = eventRef({ extensionId: "pstdio.pstdio-dev", id: "release-health.changed" });
const worker = defineCommand({
  id: "release-health.sync-worker",
  title: "Collect release test results",
  automation: true,
  run: (ctx) => syncHealth(ctx, () => ctx.events.emit(healthChanged, {})),
});
export const healthSync = defineCommand({
  id: "release-health.sync",
  title: "Refresh release pipeline health",
  cli: true,
  run: (ctx) => ctx.automation.enqueue({ command: worker.ref, input: {}, key: `health:${Date.now()}` }),
});
export const releaseCommands = {
  "release-health.history": defineCommand({
    id: "release-health.history",
    title: "Read release pipeline health",
    run: readHealth,
  }),
  "release-health.sync": healthSync,
  "release-health.sync-worker": worker,
};
