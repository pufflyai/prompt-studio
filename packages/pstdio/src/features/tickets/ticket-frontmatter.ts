type FrontmatterFields = {
  shorthand: string;
  created_at: string;
  draft: boolean | null;
  status_name: string | null;
  parent_id: string | null;
  user_prompt: string | null;
  depends_on: string | null;
  parallelizable: string | null;
  blocked_reason: string | null;
  tag_names: string[];
};

const escapeYamlScalar = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

export const buildTicketFrontmatter = (fields: FrontmatterFields) => {
  const lines: string[] = ["---"];
  const q = (v: string) => `"${escapeYamlScalar(v)}"`;

  lines.push(`ticket_id: ${q(fields.shorthand)}`);
  if (fields.user_prompt) lines.push(`user_prompt: ${q(fields.user_prompt)}`);
  lines.push(`created: ${q(fields.created_at)}`);
  if (fields.draft !== null) lines.push(`draft: ${fields.draft}`);

  if (fields.status_name) lines.push(`status: ${q(fields.status_name)}`);
  if (fields.parent_id) lines.push(`parent_id: ${q(fields.parent_id)}`);
  if (fields.depends_on) lines.push(`depends_on: ${q(fields.depends_on)}`);
  if (fields.parallelizable) lines.push(`parallelizable: ${q(fields.parallelizable)}`);
  if (fields.blocked_reason) lines.push(`blocked_reason: ${q(fields.blocked_reason)}`);
  if (fields.tag_names.length > 0) lines.push(`tags: [${fields.tag_names.map(q).join(", ")}]`);

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
};

const ACTIONABLE_FIELDS = ["status"] as const;

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

const findFrontmatterClosingIndex = (content: string) => {
  if (!content.startsWith("---")) return -1;
  return content.indexOf("---", 3);
};

const frontmatterLines = (content: string) => {
  const closingIndex = findFrontmatterClosingIndex(content);
  if (closingIndex === -1) return [];

  const block = content.slice(3, closingIndex).trim();
  if (!block) return [];
  return block.split("\n");
};

const frontmatterKey = (line: string) => {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;
  return line.slice(0, colonIndex).trim();
};

export const applyFrontmatterValues = (frontmatter: string, content: string) => {
  if (findFrontmatterClosingIndex(content) === -1) {
    return applyFrontmatter(frontmatter, content);
  }

  const overrides = new Map<string, string>();
  const overrideOrder: string[] = [];
  for (const line of frontmatterLines(frontmatter)) {
    const key = frontmatterKey(line);
    if (!key) continue;
    overrides.set(key, line);
    overrideOrder.push(key);
  }

  const existing = frontmatterLines(content);
  const merged = existing.map((line) => {
    const key = frontmatterKey(line);
    if (!key) return line;
    if (!overrides.has(key)) return line;
    return overrides.get(key)!;
  });

  for (const key of overrideOrder) {
    if (existing.some((line) => frontmatterKey(line) === key)) continue;
    const line = overrides.get(key);
    if (line) merged.push(line);
  }

  const mergedFrontmatter = ["---", ...merged, "---"].join("\n");
  return applyFrontmatter(mergedFrontmatter, content);
};
