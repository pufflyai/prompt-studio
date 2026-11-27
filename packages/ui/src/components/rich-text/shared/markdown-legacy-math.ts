import type { Nodes, Paragraph, Parent, Root } from "mdast";

interface SourceRange {
  start: number;
  end: number;
}

interface DisplayFence {
  index: number;
  offset: number;
  prefix: string;
}

const literalNodes = new Set<Nodes["type"]>([
  "code",
  "inlineCode",
  "math",
  "inlineMath",
  "html",
  "definition",
  "image",
  "imageReference",
]);

const forEachChild = (parent: Parent, visit: (node: Nodes, parent: Parent) => void) => {
  for (const node of parent.children) {
    visit(node, parent);
    if ("children" in node) forEachChild(node, visit);
  }
};

interface ParagraphContext {
  paragraph: Paragraph;
  parent: Parent;
}

const inlineNodes = new Set<Nodes["type"]>(["paragraph", "heading", "tableCell"]);

const readSyntax = (markdown: string, tree: Root) => {
  const paragraphs = new Map<number, ParagraphContext>();
  const literals: SourceRange[] = [];
  const autolinks: SourceRange[] = [];
  const inlineBlocks: SourceRange[] = [];
  forEachChild(tree, (node, parent) => {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) return;
    const range = { start, end };
    if (node.type === "paragraph") {
      const { start, end } = node.position!;
      for (let line = start.line; line <= end.line; line++) paragraphs.set(line, { paragraph: node, parent });
    }
    if (inlineNodes.has(node.type)) inlineBlocks.push(range);
    if (literalNodes.has(node.type)) literals.push(range);
    if (node.type === "link" && markdown[start] !== "[") {
      autolinks.push(range);
      return;
    }
    if (node.type === "link" || node.type === "linkReference") {
      const labelEnd = node.children.at(-1)?.position?.end.offset ?? start;
      literals.push({ start: labelEnd, end });
    }
  });

  literals.sort((a, b) => a.start - b.start);
  return { paragraphs, literals, inlineBlocks, autolinks };
};

const literalAt = (ranges: SourceRange[], start: number, end: number) => {
  let lower = 0;
  let upper = ranges.length;
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (ranges[middle]!.end <= start) lower = middle + 1;
    else upper = middle;
  }
  const range = ranges[lower];
  return range !== undefined && range.start < end;
};

const containerPrefix = /^[ \t]*(?:(?:>|[-+*][ \t]+|\d{1,9}[.)][ \t]+)[ \t]*)*/;

const inlineFence = (markdown: string, start: number, expression: string) => {
  let length = 2;
  for (const [dollars] of expression.matchAll(/\$+/g)) length = Math.max(length, dollars.length + 1);
  const lineStart = markdown.lastIndexOf("\n", start - 1) + 1;
  const prefix = markdown.slice(lineStart, start);
  if (/[\r\n]/.test(expression) && containerPrefix.exec(prefix)?.[0] === prefix) {
    // Two dollars at the start of a wrapped formula would open a display fence.
    return expression.includes("$") ? undefined : "$";
  }
  return "$".repeat(length);
};

interface InlinePair {
  open: number;
  close: number;
  wrapped: boolean;
  fence: string;
}

const inlinePairs = (markdown: string, block: SourceRange, literals: SourceRange[], autolinks: SourceRange[]) => {
  const text = markdown.slice(block.start, block.end);
  const pairs: InlinePair[] = [];
  let opener: { offset: number; closing: string } | undefined;

  for (const match of text.matchAll(/\\[\\()[\]]/g)) {
    const [token] = match;
    const offset = block.start + match.index;
    if (literalAt(literals, offset, offset + 2)) continue;
    if (token === "\\(" || token === "\\[") {
      if (!literalAt(autolinks, offset, offset + 2)) {
        opener = { offset, closing: token === "\\(" ? "\\)" : "\\]" };
      }
      continue;
    }
    if (token !== opener?.closing) continue;

    const open = opener.offset;
    opener = undefined;
    const expression = markdown.slice(open + 2, offset);
    if (!expression.trim() || literalAt(literals, open, offset + 2)) continue;
    const fence = inlineFence(markdown, open, expression);
    if (fence) pairs.push({ open, close: offset, wrapped: /[\r\n]/.test(expression), fence });
  }

  return pairs;
};

const singleLineDisplayPattern = /^( {0,3})\\\[((?:[^\\]|\\[^[\]])*)\\\][ \t]*\r?$/;
const continuedPrefix = (prefix: string) =>
  prefix.replace(/(?:[-+*]|\d{1,9}[.)])(?=[ \t])/g, (marker) => " ".repeat(marker.length));

const displayDelimiters = (line: string, offset: number, literals: SourceRange[], matchedInline: Set<number>) => {
  const prefix = containerPrefix.exec(line)?.[0] ?? "";
  const tokens = [...line.matchAll(/\\[\\[\]]/g)].filter((match) => {
    const start = offset + match.index;
    return !matchedInline.has(start) && !literalAt(literals, start, start + 2);
  });
  const first = tokens[0];
  const last = tokens.at(-1);
  const opens = first?.index === prefix.length && first[0] === "\\[";
  const closes = last?.[0] === "\\]" && last.index + 2 === line.trimEnd().length;
  if (opens && !closes) {
    return { opening: true, offset: first.index, prefix, hasContent: line.trimEnd().length > first.index + 2 };
  }
  if (closes && !opens) {
    return { opening: false, offset: last.index, prefix, hasContent: last.index > prefix.length };
  }
};

interface DisplayPair {
  open: DisplayFence;
  close: DisplayFence;
}

const findDisplayPairs = (
  sourceLines: string[],
  paragraphs: Map<number, ParagraphContext>,
  literals: SourceRange[],
  matchedInline: Set<number>,
) => {
  const pairs: DisplayPair[] = [];
  let pending: (DisplayFence & ParagraphContext & { hasContent: boolean }) | undefined;
  let offset = 0;

  for (const [index, line] of sourceLines.entries()) {
    const context = paragraphs.get(index + 1);
    const delimiter = context ? displayDelimiters(line, offset, literals, matchedInline) : undefined;
    offset += line.length + 1;
    if (pending && pending.parent !== context?.parent && !/^[ \t>]*\r?$/.test(line)) pending = undefined;
    if (!delimiter || !context) continue;

    const current = { index, offset: delimiter.offset, prefix: delimiter.prefix };
    if (delimiter.opening) {
      pending = { ...current, ...context, hasContent: delimiter.hasContent };
    } else if (pending?.parent === context.parent) {
      if ((!pending.hasContent && !delimiter.hasContent) || pending.paragraph === context.paragraph) {
        pairs.push({ open: pending, close: current });
      }
      pending = undefined;
    }
  }
  return pairs;
};

const renderInlineLines = (markdown: string, sourceLines: string[], pairs: InlinePair[], literals: SourceRange[]) => {
  const edits = pairs.flatMap(({ open, close, fence }, index) => {
    const preceding = pairs[index - 1];
    const following = pairs[index + 1];
    // Adjacent synthetic dollar runs would be read as one delimiter.
    if (preceding?.close === open - 2 || following?.open === close + 2) return [];
    if (markdown[open - 1] === "$" || markdown[close + 2] === "$") return [];
    return [
      { offset: open, fence },
      { offset: close, fence },
    ];
  });
  let editIndex = 0;
  let offset = 0;
  return sourceLines.map((line) => {
    const lineStart = offset;
    offset += line.length + 1;
    const rendered: string[] = [];
    let copied = 0;
    for (; edits[editIndex] && edits[editIndex]!.offset < offset; editIndex++) {
      const edit = edits[editIndex]!;
      const start = edit.offset - lineStart;
      rendered.push(line.slice(copied, start), edit.fence);
      copied = start + 2;
    }
    const [, indent = "", expression = ""] = singleLineDisplayPattern.exec(line) ?? [];
    if (expression.trim() && !literalAt(literals, lineStart, lineStart + line.length)) {
      return [`${indent}$$`, expression.trim(), `${indent}$$`];
    }
    return [rendered.join("") + line.slice(copied)];
  });
};

const renderLegacyMath = (source: string[], normalized: string[][], pairs: DisplayPair[]) => {
  const lines: string[] = [];
  const fences: string[] = [];
  let next = 0;
  const appendNormalized = (end: number) => {
    for (; next < end; next++) lines.push(...normalized[next]!);
  };
  for (const { open, close } of pairs) {
    appendNormalized(open.index);
    const start = lines.length;
    lines.push(`${open.prefix}$$`);
    const first = source[open.index]!.slice(open.offset + 2).trim();
    if (first) lines.push(continuedPrefix(open.prefix) + first);
    for (let index = open.index + 1; index < close.index; index++) lines.push(source[index]!);

    const last = source[close.index]!.slice(0, close.offset).trimEnd();
    const prefix = continuedPrefix(close.prefix);
    if (last.trim() !== close.prefix.trim()) lines.push(last);
    fences.push(`${start}:${open.offset}:${lines.length}`);
    lines.push(`${prefix}$$`);
    next = close.index + 1;
  }
  appendNormalized(normalized.length);
  return { markdown: lines.join("\n"), fences };
};

export const parseLegacyMath = (markdown: string, parse: (markdown: string) => Root) => {
  // Markdown itself determines code spans and block boundaries before legacy delimiters are considered.
  const original = parse(markdown);
  if (!/\\[([]/.test(markdown)) return original;

  const source = markdown.split("\n");
  const { paragraphs, literals, inlineBlocks, autolinks } = readSyntax(markdown, original);
  const inline = inlineBlocks.flatMap((block) => inlinePairs(markdown, block, literals, autolinks));
  const matchedInline = new Set(inline.filter((pair) => !pair.wrapped).flatMap(({ open, close }) => [open, close]));
  const pairs = findDisplayPairs(source, paragraphs, literals, matchedInline);
  const lines = renderInlineLines(markdown, source, inline, literals);
  const rendered = renderLegacyMath(source, lines, pairs);
  if (rendered.markdown === markdown) return original;
  const tree = parse(rendered.markdown);
  if (!pairs.length) return tree;

  const parsedFences = new Set<string>();
  forEachChild(tree, (node) => {
    if (node.type === "math" && node.position) {
      const { start, end } = node.position;
      parsedFences.add(`${start.line - 1}:${start.column - 1}:${end.line - 1}`);
    }
  });

  // Only retain a replacement when Markdown recognizes both fences in the same math block.
  const accepted = pairs.filter((_, index) => parsedFences.has(rendered.fences[index]!));
  if (accepted.length === pairs.length) return tree;
  const fallback = renderLegacyMath(source, lines, accepted).markdown;
  return fallback === markdown ? original : parse(fallback);
};
