import { defineCommand, params } from "@pstdio/sdk/extensions";
import { reportsCollection } from "../data/collections";
import { reportDir, reportFilesDirFor, reportMarkdownPathFor, requireRepoFiles } from "../data/draft-storage";
import { findReport, resolveWorkspace } from "../data/resolve";
import { assertSafeReportName } from "../data/validation";

export const deleteReportCommand = defineCommand({
  id: "reports.delete",
  title: "Delete report",
  cli: {
    globalAliases: [["reports", "delete"]],
    examples: ["pstdio reports delete --name review"],
  },
  params: {
    workspace: params.text(),
    name: params.text({ required: true }),
  },
  async run(ctx, commandParams) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const { workspace, workspaceShorthand } = await resolveWorkspace(ctx, commandParams.workspace);
    const name = commandParams.name;
    assertSafeReportName(name);
    const report = await findReport(ctx.storage, workspaceShorthand, name);
    if (!report) throw new Error(`Unknown report "${name}" in workspace "${workspaceShorthand}"`);

    const collection = reportsCollection(ctx.storage);
    const blobs = collection.attachments(report.id);
    await collection.delete(report.id);
    await Promise.allSettled(report.files.map((file) => blobs.delete(file.blobId)));
    const directoryName = report.directoryName ?? report.name;
    const siblingExists = (await collection.list()).some(
      (candidate) =>
        candidate.workspaceShorthand === workspaceShorthand &&
        (candidate.directoryName ?? candidate.name) === directoryName,
    );
    // A report without attached files has no files directory, and a report that was
    // never checked out has no paths at all, so each removal is guarded.
    if (siblingExists) {
      const markdownPath = reportMarkdownPathFor(report);
      const filesDir = reportFilesDirFor(report);
      if (await repoFiles.exists(markdownPath)) await repoFiles.delete(markdownPath);
      if (await repoFiles.exists(filesDir)) await repoFiles.delete(filesDir);
    } else {
      const directory = reportDir(directoryName);
      if (await repoFiles.exists(directory)) await repoFiles.delete(directory);
    }
    await ctx.events.emit("pstdio-reports.report.deleted", {
      projectId: ctx.projectId,
      workspaceShorthand,
      workspaceId: workspace?.id ?? null,
      name,
    });

    return { workspace: workspaceShorthand, name, deleted: true };
  },
});
