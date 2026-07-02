import { defineCommand, params } from "@pstdio/sdk/extensions";
import { reportsCollection } from "../data/collections";
import { reportDir, requireRepoFiles } from "../data/draft-storage";
import { findReport, resolveWorkspace } from "../data/resolve";
import { assertSafeReportName } from "../data/validation";

export const deleteReportCommand = defineCommand({
  title: "Delete report",
  cli: {
    globalAliases: [["reports", "delete"]],
    examples: ["pstdio reports delete --name review"],
  },
  params: {
    workspace: params.text(),
    name: params.text({ required: true }),
  },
  async run(ctx) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const { workspace, workspaceShorthand } = await resolveWorkspace(ctx, repoFiles, ctx.params.workspace);
    const name = ctx.params.name;
    assertSafeReportName(name);
    const report = await findReport(ctx.storage, workspaceShorthand, name);
    if (!report) throw new Error(`Unknown report "${name}" in workspace "${workspaceShorthand}"`);

    const collection = reportsCollection(ctx.storage);
    const blobs = collection.attachments(report.id);
    await collection.delete(report.id);
    await Promise.allSettled(report.files.map((file) => blobs.delete(file.blobId)));
    await repoFiles.delete(reportDir(name));
    await ctx.events.emit("pstdio-reports.report.deleted", {
      projectId: ctx.projectId,
      workspaceShorthand,
      workspaceId: workspace?.id ?? null,
      name,
    });

    return { workspace: workspaceShorthand, name, deleted: true };
  },
});
