import { defineCommand, type ExtensionContextBase } from "@pstdio/sdk/extensions";
import { storageReportChanged } from "./events";
import { readDatabaseSchema } from "./schema";
import { buildStorageReport, STORAGE_REPORT_FILE, STORAGE_RUN_FILE, type StorageReport } from "./storage";
import { readTimeline } from "./timeline";

let pendingRefresh = Promise.resolve();

const readStorageRun = async (ctx: Pick<ExtensionContextBase, "extensionFiles" | "automation">) => {
  if (!ctx.extensionFiles || !(await ctx.extensionFiles.exists(STORAGE_RUN_FILE))) return null;
  const id = JSON.parse(await ctx.extensionFiles.readText(STORAGE_RUN_FILE)) as string;
  return (await ctx.automation.get(id)) ?? null;
};

const storageWorker = defineCommand({
  id: "diagnostics.storage-worker",
  title: "Measure database and file storage",
  automation: true,
  async run(ctx) {
    if (!ctx.extensionFiles) throw new Error("The storage report needs a project.");
    const folder = await ctx.workspaces.getDefault();
    const report = await buildStorageReport(folder?.root_path ?? null);
    await ctx.extensionFiles.writeText(STORAGE_REPORT_FILE, JSON.stringify(report));
    return { generatedAt: report.generatedAt, durationMs: report.durationMs };
  },
});

export const diagnosticsCommands = {
  "diagnostics.database-schema": defineCommand({
    id: "diagnostics.database-schema",
    title: "Browse the declared database schema",
    cli: true,
    async run(ctx) {
      const folder = await ctx.workspaces.getDefault();
      return readDatabaseSchema(folder?.root_path ?? null);
    },
  }),
  "diagnostics.startup-timeline": defineCommand({
    id: "diagnostics.startup-timeline",
    title: "Read runtime startup and project setup timings",
    cli: true,
    async run(ctx) {
      const timeline = await readTimeline();
      const launches = timeline.launches.map((launch) => ({
        ...launch,
        setups: launch.setups.filter((setup) => setup.projectId === ctx.project.id),
      }));
      return { ...timeline, launches, projectNames: { [ctx.project.id]: ctx.project.name } as Record<string, string> };
    },
  }),
  "diagnostics.storage-report": defineCommand({
    id: "diagnostics.storage-report",
    title: "Read the latest storage report",
    cli: true,
    async run(ctx) {
      const run = await readStorageRun(ctx);
      const measuring = run?.status === "queued" || run?.status === "running";
      const report =
        ctx.extensionFiles && (await ctx.extensionFiles.exists(STORAGE_REPORT_FILE))
          ? (JSON.parse(await ctx.extensionFiles.readText(STORAGE_REPORT_FILE)) as StorageReport)
          : null;
      return {
        report,
        measuring,
        error: run?.status === "failed" ? (run.error?.message ?? "Measurement failed") : null,
      };
    },
  }),
  "diagnostics.storage-refresh": defineCommand({
    id: "diagnostics.storage-refresh",
    title: "Measure database and file storage",
    cli: true,
    run(ctx) {
      const refresh = pendingRefresh.then(async () => {
        if (!ctx.extensionFiles) throw new Error("The storage report needs a project.");
        const current = await readStorageRun(ctx);
        if (current && (current.status === "queued" || current.status === "running")) return current;
        const run = await ctx.automation.enqueue({
          command: storageWorker.ref,
          input: { workspaceId: ctx.workspaceId },
          key: `storage:${Date.now()}`,
        });
        await ctx.extensionFiles.writeText(STORAGE_RUN_FILE, JSON.stringify(run.id));
        await ctx.events.emit(storageReportChanged, {});
        return run;
      });
      pendingRefresh = refresh.then(
        () => undefined,
        () => undefined,
      );
      return refresh;
    },
  }),
  "diagnostics.storage-worker": storageWorker,
};
