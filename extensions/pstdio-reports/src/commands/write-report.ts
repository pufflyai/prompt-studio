import type { CommandContext } from "@pstdio/sdk/extensions";
import { defineCommand, params } from "@pstdio/sdk/extensions";
import { putReport } from "../data/collections";
import { reportFilesDir, reportMarkdownPath, reportToMarkdown, requireRepoFiles } from "../data/draft-storage";
import { findReport, resolveReportName, resolveWorkspace } from "../data/resolve";

const resolveTemplateBody = async (ctx: CommandContext<{ template?: string }>) => {
  const name = ctx.params.template ?? "report";
  const template = await ctx.templates.get(name);
  if (!template) {
    throw new Error(`Unknown report template "${name}"`);
  }
  if (template.template_type !== "report") throw new Error(`Template "${name}" is not a report template`);
  return template.content;
};

export const writeReportCommand = defineCommand({
  title: "Write report",
  cli: {
    globalAliases: [["reports", "write"]],
    examples: ["pstdio reports write --kind review"],
  },
  params: {
    workspace: params.text(),
    kind: params.text(),
    name: params.text(),
    template: params.template({ label: "Template", type: "report", required: false }),
    source: params.text(),
  },
  async run(ctx) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const kind = ctx.params.kind ?? "report";
    const name = resolveReportName(ctx.params.name, kind);
    const { workspace, workspaceShorthand } = await resolveWorkspace(ctx, repoFiles, ctx.params.workspace);
    const existing = await findReport(ctx.storage, workspaceShorthand, name);
    if (existing) {
      return { workspace: workspaceShorthand, name, path: reportMarkdownPath(name), filesPath: reportFilesDir(name) };
    }

    const now = new Date().toISOString();
    const report = await putReport(ctx.storage, {
      id: crypto.randomUUID(),
      workspaceShorthand,
      workspaceId: workspace?.id ?? null,
      name,
      kind,
      source: ctx.params.source ?? null,
      body: await resolveTemplateBody(ctx),
      files: [],
      draft: true,
      createdAt: now,
      updatedAt: now,
    });

    await repoFiles.writeText(reportMarkdownPath(name), reportToMarkdown(report));
    await ctx.events.emit("pstdio-reports.report.created", {
      projectId: ctx.projectId,
      workspaceShorthand,
      workspaceId: workspace?.id ?? null,
      name,
      kind,
      source: report.source,
      path: reportMarkdownPath(name),
    });

    return { workspace: workspaceShorthand, name, path: reportMarkdownPath(name), filesPath: reportFilesDir(name) };
  },
});
