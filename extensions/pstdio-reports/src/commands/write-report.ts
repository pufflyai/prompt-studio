import type { CommandContext } from "@pstdio/sdk/extensions";
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { reportTemplateNames } from "../../report-templates";
import { putReport, reportsCollection } from "../data/collections";
import {
  reportFilesDir,
  reportInstanceName,
  reportMarkdownPath,
  reportToMarkdown,
  requireRepoFiles,
} from "../data/draft-storage";
import { resolveReportName, resolveWorkspace } from "../data/resolve";

const resolveTemplateBody = async (ctx: CommandContext, name: string | undefined) => {
  if (!name) {
    throw new Error(`Report template is required. Available templates: ${reportTemplateNames.join(", ")}`);
  }
  const template = await ctx.templates.get(name);
  if (!template) {
    throw new Error(`Unknown report template "${name}"`);
  }
  if (template.template_type !== "report") throw new Error(`Template "${name}" is not a report template`);
  return template.content;
};

const resolveAvailableReport = async (
  ctx: CommandContext<Record<string, unknown>>,
  repoFiles: NonNullable<CommandContext["repoFiles"]>,
  workspaceShorthand: string,
  directoryName: string,
) => {
  const reports = (await reportsCollection(ctx.storage).list()).filter(
    (report) => report.workspaceShorthand === workspaceShorthand,
  );
  let sequence = 0;

  while (true) {
    const name = reportInstanceName(directoryName, sequence);
    const path = reportMarkdownPath(directoryName, sequence);
    const nameExists = reports.some((report) => report.name === name);
    if (!nameExists && !(await repoFiles.exists(path))) {
      return { name, path, filesPath: reportFilesDir(directoryName, sequence) };
    }
    sequence += 1;
  }
};

export const writeReportCommand = defineCommand({
  title: "Write report",
  cli: {
    globalAliases: [["reports", "write"]],
    examples: ["pstdio reports write --kind review --template review"],
  },
  params: {
    workspace: params.text(),
    kind: params.text(),
    name: params.text(),
    template: params.template({ label: "Template", type: "report", required: false }),
    source: params.text(),
  },
  async run(ctx, commandParams) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const kind = commandParams.kind ?? "report";
    const directoryName = resolveReportName(commandParams.name, kind);
    const templateBody = await resolveTemplateBody(ctx, commandParams.template);
    const { workspace, workspaceShorthand } = await resolveWorkspace(ctx, repoFiles, commandParams.workspace);
    const { name, path, filesPath } = await resolveAvailableReport(ctx, repoFiles, workspaceShorthand, directoryName);

    const now = new Date().toISOString();
    const report = await putReport(ctx.storage, {
      id: crypto.randomUUID(),
      workspaceShorthand,
      workspaceId: workspace?.id ?? null,
      name,
      directoryName,
      kind,
      source: commandParams.source ?? null,
      body: templateBody,
      files: [],
      draft: true,
      createdAt: now,
      updatedAt: now,
    });

    await repoFiles.writeText(path, reportToMarkdown(report));
    await ctx.events.emit("pstdio-reports.report.created", {
      projectId: ctx.projectId,
      reportId: report.id,
      workspaceShorthand,
      workspaceId: workspace?.id ?? null,
      name,
      kind,
      source: report.source,
      path,
    });

    return { reportId: report.id, workspace: workspaceShorthand, name, path, filesPath };
  },
});
