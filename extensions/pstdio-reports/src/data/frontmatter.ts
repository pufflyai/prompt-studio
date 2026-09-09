import {
  findClosingFrontmatterDelimiter,
  quoteYamlScalar as q,
  stripFrontmatter,
  unquoteYamlScalar as unquote,
} from "@pstdio/sdk/data";

export { applyFrontmatter, stripFrontmatter } from "@pstdio/sdk/data";
export interface ReportFrontmatterFields {
  reportName: string;
  kind: string;
  source: string | null;
  createdAt: string;
  draft: boolean;
}

export interface ParsedReportFrontmatter {
  reportName?: string;
  kind?: string;
  source?: string;
  createdAt?: string;
  draft?: boolean;
}

export const buildReportFrontmatter = (fields: ReportFrontmatterFields) => {
  const lines = [
    "---",
    `report_name: ${q(fields.reportName)}`,
    `kind: ${q(fields.kind)}`,
    `created: ${q(fields.createdAt)}`,
    `draft: ${fields.draft}`,
  ];
  if (fields.source) lines.splice(3, 0, `source: ${q(fields.source)}`);
  lines.push("---");
  return lines.join("\n");
};

export const parseReportFrontmatter = (content: string): ParsedReportFrontmatter => {
  if (!content.startsWith("---")) return {};
  const delimiter = findClosingFrontmatterDelimiter(content);
  if (!delimiter) return {};

  const result: ParsedReportFrontmatter = {};
  for (const line of content.slice(3, delimiter.start).trim().split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const raw = line.slice(colonIndex + 1).trim();
    if (!raw) continue;
    const value = unquote(raw);

    if (key === "report_name") result.reportName = value;
    if (key === "kind") result.kind = value;
    if (key === "source") result.source = value;
    if (key === "created") result.createdAt = value;
    if (key === "draft") result.draft = raw === "true";
  }
  return result;
};
