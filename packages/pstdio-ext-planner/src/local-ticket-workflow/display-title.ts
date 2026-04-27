const MAX_DISPLAY_TITLE_LENGTH = 50;

const extractFirstHeading = (content: string) => {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) return trimmed.slice(2).trim();
  }
  return null;
};

const extractFirstNonEmptyLine = (content: string) => {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return null;
};

const stripMarkdownFormatting = (text: string) =>
  text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/`([^`]*)`/g, "$1");

const slugify = (text: string, maxLength: number) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");

export const extractDisplayTitle = (content: string) => {
  const raw = extractFirstHeading(content) ?? extractFirstNonEmptyLine(content) ?? "untitled";
  const stripped = stripMarkdownFormatting(raw);
  return slugify(stripped, MAX_DISPLAY_TITLE_LENGTH);
};
