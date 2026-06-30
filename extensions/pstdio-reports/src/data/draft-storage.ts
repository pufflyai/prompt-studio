import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { applyFrontmatter, buildReportFrontmatter } from "./frontmatter";
import type { StoredReport } from "./types";

export const REPORTS_DIR = ".pstdio/reports";

export const reportDir = (name: string) => `${REPORTS_DIR}/${name}`;
export const reportMarkdownPath = (name: string) => `${reportDir(name)}/report.md`;
export const reportFilesDir = (name: string) => `${reportDir(name)}/files`;
export const reportFilesPattern = (name: string) => `${reportFilesDir(name)}/**`;
export const fileNameFromPath = (name: string, path: string) => path.slice(`${reportFilesDir(name)}/`.length);

export const reportToMarkdown = (report: StoredReport) =>
  applyFrontmatter(
    buildReportFrontmatter({
      reportName: report.name,
      kind: report.kind,
      source: report.source,
      createdAt: report.createdAt,
      draft: report.draft,
    }),
    report.body,
  );

export const readReportMarkdown = async (repoFiles: ArtifactMount, name: string) => {
  const path = reportMarkdownPath(name);
  if (!(await repoFiles.exists(path))) return null;
  return repoFiles.readText(path);
};

export const requireRepoFiles = (repoFiles: ArtifactMount | undefined): ArtifactMount => {
  if (!repoFiles) throw new Error("This command must be run inside a project repository.");
  return repoFiles;
};
