import { defineCommand, params } from "@pstdio/sdk/extensions";
import { healthChanged } from "./events";
import { readHealth, syncHealth } from "./history";
import { inspectRelease } from "./inspection";
import { HEALTH_SYNC_FILE, readHealthSync } from "./sync-state";

let requesting = Promise.resolve();
const serializeRefresh = <T>(work: () => Promise<T>) => {
  const next = requesting.then(work);
  requesting = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
};
const worker = defineCommand({
  id: "release-health.sync-worker",
  title: "Collect release test results",
  automation: true,
  async run(ctx) {
    try {
      return await syncHealth(ctx, () => ctx.events.emit(healthChanged, {}));
    } finally {
      await ctx.events.emit(healthChanged, {});
    }
  },
});
export const healthSync = defineCommand({
  id: "release-health.sync",
  title: "Refresh release pipeline health",
  cli: true,
  run: (ctx) =>
    serializeRefresh(async () => {
      if (!ctx.extensionFiles) throw new Error("Release history needs a project.");
      const current = await readHealthSync(ctx);
      if (current && (current.status === "queued" || current.status === "running")) return current;
      const run = await ctx.automation.enqueue({
        command: worker.ref,
        input: { workspaceId: ctx.workspaceId },
        key: `health:${Date.now()}`,
      });
      await ctx.extensionFiles.writeText(HEALTH_SYNC_FILE, JSON.stringify(run.id));
      await ctx.events.emit(healthChanged, {});
      return run;
    }),
});
export const releaseCommands = {
  "release-health.history": defineCommand({
    id: "release-health.history",
    title: "Read release pipeline health",
    cli: true,
    async run(ctx) {
      const history = await readHealth(ctx);
      const sync = await readHealthSync(ctx);
      const syncing = sync?.status === "queued" || sync?.status === "running";
      return { ...history, error: sync?.error?.message ?? history.error, syncing, sync };
    },
  }),
  "release-health.inspect": defineCommand({
    id: "release-health.inspect",
    title: "Inspect a live release run and its cached evidence",
    cli: true,
    params: { runId: params.text({ label: "GitHub run ID; defaults to the latest release workflow run" }) },
    run: (ctx, { runId }) => inspectRelease(ctx, runId),
  }),
  "release-health.sync": healthSync,
  "release-health.sync-worker": worker,
};
