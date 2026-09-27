import type { CommandContext } from "@pstdio/sdk/extensions";
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { reportTemplateNames } from "../../report-templates";
import { putReport, reportsCollection } from "../data/collections";
import {
  reportFilesDir,
  reportInstanceName,
  reportMarkdownPath,
  reportToMarkdown,
  requireReportDraftFiles,
} from "../data/draft-storage";
import { resolveReportName, resolveWorkspace } from "../data/resolve";
import { readReportTemplate } from "../data/template-store";

const resolveTemplateBody = async (ctx: CommandContext, name: string | undefined) => {
  if (!name) {
    throw new Error(`Report template is required. Available templates: ${reportTemplateNames.join(", ")}`);
  }
  const template = await readReportTemplate(ctx, name);
  if (!template) {
    throw new Error(`Unknown report template "${name}"`);
  }
  return template.content;
};

const resolveAvailableReport = async (
  ctx: CommandContext<Record<string, unknown>>,
  projectFiles: NonNullable<CommandContext["projectFiles"]>,
  directoryName: string,
) => {
  const reports = await reportsCollection(ctx.storage).list();
  let sequence = 0;

  while (true) {
    const name = reportInstanceName(directoryName, sequence);
    const path = reportMarkdownPath(directoryName, sequence);
    const nameExists = reports.some((report) => report.name === name);
    if (!nameExists && !(await projectFiles.exists(path))) {
      return { name, path, filesPath: reportFilesDir(directoryName, sequence) };
    }
    sequence += 1;
  }
};

export const writeReportCommand = defineCommand({
  id: "reports.write",
  title: "Write report",
  cli: {
    globalAliases: [["reports", "write"]],
    examples: ["pstdio reports write --kind review --template review"],
  },
  params: {
    workspace: params.text(),
    kind: params.text(),
    name: params.text(),
    template: params.select({
      label: "Template",
      options: reportTemplateNames.map((name) => ({ label: name, value: name })),
      required: false,
    }),
    source: params.text(),
  },
  async run(ctx, commandParams) {
    const { projectFiles, resolvePath } = await requireReportDraftFiles(ctx);
    const kind = commandParams.kind ?? "report";
    const directoryName = resolveReportName(commandParams.name, kind);
    const templateBody = await resolveTemplateBody(ctx, commandParams.template);
    const { workspace, workspaceShorthand } = await resolveWorkspace(ctx, commandParams.workspace);
    const { name, path, filesPath } = await resolveAvailableReport(ctx, projectFiles, directoryName);

    const now = new Date().toISOString();
    const report = await putReport(ctx.storage, {
      ...(await ctx.resources.allocate({ kind: "report" })),
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

    await projectFiles.writeText(path, reportToMarkdown(report));
    await ctx.events.emit("pstdio-reports.report.created", {
      projectId: ctx.projectId,
      reportId: report.id,
      workspaceShorthand,
      workspaceId: workspace?.id ?? null,
      name,
      kind,
      source: report.source,
      path: resolvePath(path),
    });

    return {
      reportId: report.id,
      shorthand: report.shorthand,
      workspace: workspaceShorthand,
      name,
      path: resolvePath(path),
      filesPath: resolvePath(filesPath),
    };
  },
});
