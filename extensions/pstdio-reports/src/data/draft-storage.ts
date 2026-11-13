import { resolve } from "node:path";
import { createDraftLayout, requireRepoFiles } from "@pstdio/sdk/data";
import type { ArtifactMount, ExtensionContextBase } from "@pstdio/sdk/extensions";
import { applyFrontmatter, buildReportFrontmatter } from "./frontmatter";
import type { StoredReport } from "./types";

export const REPORTS_DIR = ".pstdio/extension-storage/pstdio.pstdio-reports/reports";

const layout = createDraftLayout(REPORTS_DIR, "report");
export const reportDir = layout.directory;
const reportSuffix = (sequence: number) => (sequence === 0 ? "" : `_${sequence.toString().padStart(2, "0")}`);

export const reportInstanceName = (name: string, sequence = 0) => `${name}${reportSuffix(sequence)}`;
export const reportMarkdownPath = (name: string, sequence = 0) =>
  `${reportDir(name)}/report${reportSuffix(sequence)}.md`;
export const reportFilesDir = (name: string, sequence = 0) => `${reportDir(name)}/files${reportSuffix(sequence)}`;

const reportInstanceSuffix = (report: StoredReport) => {
  const directoryName = report.directoryName ?? report.name;
  return report.name.startsWith(directoryName) ? report.name.slice(directoryName.length) : "";
};

export const reportMarkdownPathFor = (report: StoredReport) => {
  const directoryName = report.directoryName ?? report.name;
  return `${reportDir(directoryName)}/report${reportInstanceSuffix(report)}.md`;
};

export const reportFilesDirFor = (report: StoredReport) => {
  const directoryName = report.directoryName ?? report.name;
  return `${reportDir(directoryName)}/files${reportInstanceSuffix(report)}`;
};

export const reportFilesPattern = (report: StoredReport) => `${reportFilesDirFor(report)}/**`;
export const fileNameFromPath = (report: StoredReport, path: string) =>
  path.slice(`${reportFilesDirFor(report)}/`.length);

export const reportToMarkdown = (report: StoredReport, body: string) =>
  applyFrontmatter(
    buildReportFrontmatter({
      reportName: report.name,
      kind: report.kind,
      source: report.source,
      createdAt: report.createdAt,
      draft: report.draft,
    }),
    body,
  );

export const readReportMarkdown = async (projectFiles: ArtifactMount, report: StoredReport) => {
  const path = reportMarkdownPathFor(report);
  if (!(await projectFiles.exists(path))) return null;
  return projectFiles.readText(path);
};

export const requireReportDraftFiles = async (
  ctx: Pick<ExtensionContextBase, "projectFiles" | "workspaces" | "extensionId">,
) => {
  const projectFiles = requireRepoFiles(ctx.projectFiles);
  const home = await ctx.workspaces.getDefault();
  if (home?.execution_kind !== "local" || !home.root_path) {
    throw new Error("Report drafts require a local project folder.");
  }
  const root = home.root_path;
  // Existing hosts keep their historical root; a migration-capable host supplies the canonical owner.
  const previous = ".pstdio/extension-storage/pstdio.pstdio-reports";
  const allocated = ctx.extensionId === "pstdio.reports" ? `.pstdio/extension-storage/${ctx.extensionId}` : previous;
  return {
    projectFiles,
    resolvePath: (path: string) =>
      resolve(
        root,
        path === previous || path.startsWith(`${previous}/`) ? `${allocated}${path.slice(previous.length)}` : path,
      ),
  };
};
