const MAX_DISPLAY_TITLE_LENGTH = 50;
const MAX_DIR_NAME_LENGTH = 80;

const stripFrontmatter = (content: string) => {
  if (!content.startsWith("---")) return content;
  const closingIndex = content.indexOf("---", 3);
  if (closingIndex === -1) return content;
  return content.slice(closingIndex + 3);
};

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
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) → text
    .replace(/\*\*([^*]*)\*\*/g, "$1") // **bold** → bold
    .replace(/\*([^*]*)\*/g, "$1") // *italic* → italic
    .replace(/`([^`]*)`/g, "$1"); // `code` → code

const slugify = (text: string, maxLength: number) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");

export const extractDisplayTitle = (content: string) => {
  const body = stripFrontmatter(content);
  const raw = extractFirstHeading(body) ?? extractFirstNonEmptyLine(body) ?? "untitled";
  const stripped = stripMarkdownFormatting(raw);
  return slugify(stripped, MAX_DISPLAY_TITLE_LENGTH);
};

export const ticketDirName = (shorthand: string, content: string) => {
  const displayTitle = extractDisplayTitle(content);
  const name = `${shorthand}_${displayTitle}`;
  if (name.length > MAX_DIR_NAME_LENGTH) {
    const maxTitleLen = MAX_DIR_NAME_LENGTH - shorthand.length - 1;
    return `${shorthand}_${slugify(displayTitle, maxTitleLen)}`;
  }
  return name;
};
