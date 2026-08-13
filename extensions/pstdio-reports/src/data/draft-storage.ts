import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { applyFrontmatter, buildReportFrontmatter } from "./frontmatter";
import type { StoredReport } from "./types";

export const REPORTS_DIR = ".pstdio/reports";

export const reportDir = (name: string) => `${REPORTS_DIR}/${name}`;
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

export const readReportMarkdown = async (repoFiles: ArtifactMount, report: StoredReport) => {
  const path = reportMarkdownPathFor(report);
  if (!(await repoFiles.exists(path))) return null;
  return repoFiles.readText(path);
};

export const requireRepoFiles = (repoFiles: ArtifactMount | undefined): ArtifactMount => {
  if (!repoFiles) throw new Error("This command must be run inside a project repository.");
  return repoFiles;
};
