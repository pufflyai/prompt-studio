import { defineCommand } from "@pstdio/sdk/extensions";
import { healthChanged } from "./events";
import { readHealth, syncHealth } from "./history";

let requesting = Promise.resolve();
const serializeRefresh = <T>(work: () => Promise<T>) => {
  const next = requesting.then(work);
  requesting = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
};
const syncFile = "releases/sync.json";
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
      if (await ctx.extensionFiles.exists(syncFile)) {
        const id = JSON.parse(await ctx.extensionFiles.readText(syncFile)) as string;
        const current = await ctx.automation.get(id);
        if (current && (current.status === "queued" || current.status === "running")) return current;
      }
      const run = await ctx.automation.enqueue({
        command: worker.ref,
        input: { workspaceId: ctx.workspaceId },
        key: `health:${Date.now()}`,
      });
      await ctx.extensionFiles.writeText(syncFile, JSON.stringify(run.id));
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
      let syncing = false;
      let syncError: string | undefined;
      if (ctx.extensionFiles && (await ctx.extensionFiles.exists(syncFile))) {
        const id = JSON.parse(await ctx.extensionFiles.readText(syncFile)) as string;
        const run = await ctx.automation.get(id);
        syncing = run?.status === "queued" || run?.status === "running";
        if (run?.status === "failed") syncError = run.error?.message;
      }
      return { ...history, error: syncError ?? history.error, syncing };
    },
  }),
  "release-health.sync": healthSync,
  "release-health.sync-worker": worker,
};
