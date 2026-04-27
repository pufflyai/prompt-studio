type FrontmatterFields = {
  shorthand: string;
  createdAt: string;
  draft: boolean | null;
  parentId: string | null;
  userPrompt: string | null;
  dependsOn: string | null;
  parallelizable: string | null;
  blockedReason: string | null;
  tagNames: string[];
};

const escapeYamlScalar = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

export const buildTicketFrontmatter = (fields: FrontmatterFields) => {
  const lines: string[] = ["---"];
  const q = (v: string) => `"${escapeYamlScalar(v)}"`;

  lines.push(`ticket_id: ${q(fields.shorthand)}`);
  if (fields.userPrompt) lines.push(`user_prompt: ${q(fields.userPrompt)}`);
  lines.push(`created: ${q(fields.createdAt)}`);
  if (fields.draft !== null) lines.push(`draft: ${fields.draft}`);
  if (fields.parentId) lines.push(`parent_id: ${q(fields.parentId)}`);
  if (fields.dependsOn) lines.push(`depends_on: ${q(fields.dependsOn)}`);
  if (fields.parallelizable) lines.push(`parallelizable: ${q(fields.parallelizable)}`);
  if (fields.blockedReason) lines.push(`blocked_reason: ${q(fields.blockedReason)}`);
  if (fields.tagNames.length > 0) lines.push(`tags: [${fields.tagNames.map(q).join(", ")}]`);

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
  blockedReason?: string;
  parentId?: string;
};

const ACTIONABLE_FIELDS: Record<string, keyof ParsedFrontmatter> = {
  blocked_reason: "blockedReason",
  parent_id: "parentId",
};
const OMITTED_FRONTMATTER_KEYS = new Set(["status"]);

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
    const field = ACTIONABLE_FIELDS[key];

    if (!raw || !field) continue;
    result[field] = raw;
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
    if (!key || OMITTED_FRONTMATTER_KEYS.has(key)) continue;
    overrides.set(key, line);
    overrideOrder.push(key);
  }

  const existing = frontmatterLines(content).filter((line) => {
    const key = frontmatterKey(line);
    return key ? !OMITTED_FRONTMATTER_KEYS.has(key) : true;
  });

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
