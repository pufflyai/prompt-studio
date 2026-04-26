const FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;

const FENCE_PATTERN = /^```/;
const LIST_ITEM_PATTERN = /^([ \t]*)((?:[-*+])|(?:\d+\.))\s+/;
const INDENTED_LINE_PATTERN = /^([ \t]+)/;

interface ActiveListIndent {
  normalizedIndentWidth: number;
  sourceIndentWidth: number;
}

interface MarkdownListState {
  isInCodeFence: boolean;
  activeListIndents: ActiveListIndent[];
}

function getExpandedIndentWidth(indent: string) {
  let width = 0;

  for (const char of indent) {
    width += char === "\t" ? 4 : 1;
  }

  return width;
}

function findParentIndent(activeListIndents: ActiveListIndent[], sourceIndentWidth: number) {
  return [...activeListIndents].reverse().find((indent) => indent.sourceIndentWidth < sourceIndentWidth);
}

function toNormalizedIndent(indent: string, normalizedWidth: number, sourceWidth: number) {
  if (normalizedWidth === sourceWidth && !indent.includes("\t")) return indent;
  return " ".repeat(normalizedWidth);
}

function normalizeIndentedContinuation(line: string, activeListIndents: ActiveListIndent[]) {
  const indentedLineMatch = line.match(INDENTED_LINE_PATTERN);
  if (!indentedLineMatch) {
    if (line.trim() !== "") {
      activeListIndents.length = 0;
    }

    return line;
  }

  const sourceIndentWidth = getExpandedIndentWidth(indentedLineMatch[1]);
  const parentLevel = findParentIndent(activeListIndents, sourceIndentWidth);
  if (!parentLevel) return line;

  const normalizedIndentWidth = sourceIndentWidth + (parentLevel.normalizedIndentWidth - parentLevel.sourceIndentWidth);
  const normalizedIndent = toNormalizedIndent(indentedLineMatch[1], normalizedIndentWidth, sourceIndentWidth);

  if (normalizedIndent === indentedLineMatch[1]) return line;

  return `${normalizedIndent}${line.slice(indentedLineMatch[1].length)}`;
}

function normalizeListItem(line: string, match: RegExpMatchArray, activeListIndents: ActiveListIndent[]) {
  const sourceIndentWidth = getExpandedIndentWidth(match[1]);

  while (activeListIndents.length && activeListIndents.at(-1)!.sourceIndentWidth > sourceIndentWidth) {
    activeListIndents.pop();
  }

  const currentLevel = activeListIndents.at(-1);
  if (currentLevel?.sourceIndentWidth === sourceIndentWidth) {
    return `${toNormalizedIndent(match[1], currentLevel.normalizedIndentWidth, sourceIndentWidth)}${line.slice(match[1].length)}`;
  }

  const parentLevel = activeListIndents.at(-1);
  const indentStep = sourceIndentWidth - (parentLevel?.sourceIndentWidth ?? 0);
  let normalizedIndentWidth = sourceIndentWidth;

  if (parentLevel && indentStep === 2 && !match[1].includes("\t")) {
    normalizedIndentWidth = parentLevel.normalizedIndentWidth + 4;
  }

  activeListIndents.push({ normalizedIndentWidth, sourceIndentWidth });

  return `${toNormalizedIndent(match[1], normalizedIndentWidth, sourceIndentWidth)}${line.slice(match[1].length)}`;
}

function normalizeMarkdownLine(line: string, state: MarkdownListState) {
  if (FENCE_PATTERN.test(line.trimStart())) {
    state.isInCodeFence = !state.isInCodeFence;
    return line;
  }

  if (state.isInCodeFence) return line;

  const match = line.match(LIST_ITEM_PATTERN);
  if (!match) return normalizeIndentedContinuation(line, state.activeListIndents);

  return normalizeListItem(line, match, state.activeListIndents);
}

export function normalizeMarkdownListIndentation(content: string) {
  const lines = content.split("\n");
  const state: MarkdownListState = { isInCodeFence: false, activeListIndents: [] };

  return lines.map((line) => normalizeMarkdownLine(line, state)).join("\n");
}

export function splitFrontmatter(content: string) {
  const match = content.match(FRONTMATTER_PATTERN);
  if (!match) {
    return { frontmatter: "", body: content };
  }
  return {
    frontmatter: match[0],
    body: content.slice(match[0].length),
  };
}
