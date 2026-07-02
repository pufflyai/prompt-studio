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

const escapeYamlScalar = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
const q = (value: string) => `"${escapeYamlScalar(value)}"`;

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

const findClosingFrontmatterDelimiter = (content: string) => {
  const match = /\n---[ \t]*(?:\r?\n|$)/.exec(content.slice(3));
  if (!match) return null;
  const start = 3 + match.index + 1;
  const end = 3 + match.index + match[0].length;
  return { end, start };
};

export const stripFrontmatter = (content: string) => {
  if (!content.startsWith("---")) return content;
  const delimiter = findClosingFrontmatterDelimiter(content);
  if (!delimiter) return content;
  return content.slice(delimiter.end);
};

export const applyFrontmatter = (frontmatter: string, content: string) => {
  const body = stripFrontmatter(content).replace(/^\n+/, "");
  if (!body) return frontmatter;
  return `${frontmatter}\n\n${body}`;
};

const unescapeYamlScalar = (value: string) => {
  let result = "";
  for (let index = 0; index < value.length; index++) {
    const current = value[index];
    const next = value[index + 1];
    if (current !== "\\" || next === undefined) {
      result += current;
      continue;
    }
    if (next === "n") result += "\n";
    else if (next === '"') result += '"';
    else if (next === "\\") result += "\\";
    else result += `${current}${next}`;
    index++;
  }
  return result;
};

const unquote = (value: string) => {
  const quoted = value.match(/^(["'])(.*)\1$/);
  return quoted ? unescapeYamlScalar(quoted[2] ?? "") : value;
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
