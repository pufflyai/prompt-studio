// Frontmatter helpers for the local-file draft workflow (`tickets write/save/pull`).
// Ported from the legacy pstdio CLI so the draft round-trip lives entirely in the
// extension; the host only provides the generic file primitive (ctx.repoFiles).

export interface TicketFrontmatterFields {
  shorthand: string;
  createdAt: string;
  draft: boolean | null;
  parentShorthand: string | null;
  userPrompt: string | null;
  dependsOn: string[];
  parallelizable: string | null;
  blockedReason: string | null;
  tagNames: string[];
}

const escapeYamlScalar = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
const q = (value: string) => `"${escapeYamlScalar(value)}"`;
const formatList = (values: string[]) => `[${values.map(q).join(", ")}]`;

export const buildTicketFrontmatter = (fields: TicketFrontmatterFields) => {
  const lines = ["---", `ticket_id: ${q(fields.shorthand)}`];

  if (fields.userPrompt) lines.push(`user_prompt: ${q(fields.userPrompt)}`);
  lines.push(`created: ${q(fields.createdAt)}`);
  if (fields.draft !== null) lines.push(`draft: ${fields.draft}`);
  if (fields.parentShorthand) lines.push(`parent_id: ${q(fields.parentShorthand)}`);
  if (fields.dependsOn.length > 0) lines.push(`depends_on: ${formatList(fields.dependsOn)}`);
  if (fields.parallelizable) lines.push(`parallelizable: ${q(fields.parallelizable)}`);
  if (fields.blockedReason) lines.push(`blocked_reason: ${q(fields.blockedReason)}`);
  if (fields.tagNames.length > 0) lines.push(`tags: ${formatList(fields.tagNames)}`);

  lines.push("---");
  return lines.join("\n");
};

export const stripFrontmatter = (content: string) => {
  if (!content.startsWith("---")) return content;
  const closingIndex = content.indexOf("---", 3);
  if (closingIndex === -1) return content;
  return content.slice(closingIndex + 3);
};

export const applyFrontmatter = (frontmatter: string, content: string) => {
  const body = stripFrontmatter(content).replace(/^\n+/, "");
  if (!body) return frontmatter;
  return `${frontmatter}\n\n${body}`;
};

export interface ParsedTicketFrontmatter {
  userPrompt?: string;
  draft?: boolean;
  parentShorthand?: string;
  dependsOn?: string[];
  parallelizable?: string;
  blockedReason?: string;
  tagNames?: string[];
}

const unquote = (value: string) => value.replace(/^["']|["']$/g, "");

const parseList = (raw: string) => {
  const inner = raw.replace(/^\[/, "").replace(/\]$/, "");
  return inner
    .split(",")
    .map((entry) => unquote(entry.trim()))
    .filter(Boolean);
};

const FRONTMATTER_KEYS: Record<string, keyof ParsedTicketFrontmatter> = {
  user_prompt: "userPrompt",
  parent_id: "parentShorthand",
  parallelizable: "parallelizable",
  blocked_reason: "blockedReason",
};

const assignFrontmatterField = (result: ParsedTicketFrontmatter, key: string, raw: string) => {
  if (key === "draft") {
    result.draft = raw === "true";
    return;
  }
  if (key === "tags") {
    result.tagNames = parseList(raw);
    return;
  }
  if (key === "depends_on") {
    result.dependsOn = raw.startsWith("[") ? parseList(raw) : [unquote(raw)];
    return;
  }

  const field = FRONTMATTER_KEYS[key];
  if (!field) return;

  // An empty quoted scalar (e.g. `parent_id: ""`) means "absent", matching the
  // serializer which omits empty fields. Keeping "" would make the save path
  // resolve it as a reference to an unknown ticket.
  const value = unquote(raw);
  if (value) result[field] = value as never;
};

export const parseTicketFrontmatter = (content: string): ParsedTicketFrontmatter => {
  if (!content.startsWith("---")) return {};
  const closingIndex = content.indexOf("---", 3);
  if (closingIndex === -1) return {};

  const result: ParsedTicketFrontmatter = {};
  for (const line of content.slice(3, closingIndex).trim().split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const raw = line.slice(colonIndex + 1).trim();
    if (raw) assignFrontmatterField(result, key, raw);
  }

  return result;
};
