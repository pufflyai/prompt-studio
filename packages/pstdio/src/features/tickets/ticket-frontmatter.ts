type FrontmatterFields = {
  shorthand: string;
  created_at: string;
  status_name: string | null;
  parent_id: string | null;
  priority: string | null;
  complexity: string | null;
  depends_on: string | null;
  parallelizable: string | null;
  blocked_reason: string | null;
};

export const buildTicketFrontmatter = (fields: FrontmatterFields) => {
  const lines: string[] = ["---"];

  lines.push(`ticket_id: "${fields.shorthand}"`);
  lines.push(`created: "${fields.created_at}"`);

  if (fields.status_name) lines.push(`status: "${fields.status_name}"`);
  if (fields.parent_id) lines.push(`parent_id: "${fields.parent_id}"`);
  if (fields.priority) lines.push(`priority: "${fields.priority}"`);
  if (fields.complexity) lines.push(`complexity: "${fields.complexity}"`);
  if (fields.depends_on) lines.push(`depends_on: "${fields.depends_on}"`);
  if (fields.parallelizable) lines.push(`parallelizable: "${fields.parallelizable}"`);
  if (fields.blocked_reason) lines.push(`blocked_reason: "${fields.blocked_reason}"`);

  lines.push("---");
  return lines.join("\n");
};

export const stripFrontmatter = (content: string) => {
  if (!content.startsWith("---")) return content;
  const closingIndex = content.indexOf("---", 3);
  if (closingIndex === -1) return content;
  return content.slice(closingIndex + 3);
};

type ParsedFrontmatter = {
  status?: string;
  priority?: string;
  complexity?: string;
};

const ACTIONABLE_FIELDS = ["status", "priority", "complexity"] as const;

export const parseFrontmatter = (content: string): ParsedFrontmatter => {
  if (!content.startsWith("---")) return {};
  const closingIndex = content.indexOf("---", 3);
  if (closingIndex === -1) return {};

  const block = content.slice(3, closingIndex).trim();
  const result: ParsedFrontmatter = {};

  for (const line of block.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const raw = line
      .slice(colonIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!raw) continue;
    if (ACTIONABLE_FIELDS.includes(key as (typeof ACTIONABLE_FIELDS)[number])) {
      result[key as keyof ParsedFrontmatter] = raw;
    }
  }

  return result;
};

export const applyFrontmatter = (frontmatter: string, content: string) => {
  const body = stripFrontmatter(content).replace(/^\n+/, "");
  if (!body) return frontmatter;
  return `${frontmatter}\n\n${body}`;
};
