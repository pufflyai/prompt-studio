import type { Nodes, Paragraph, Parent, Root } from "mdast";
import { closingMathFenceLine } from "./markdown-math-syntax";

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

interface InlinePair {
  open: number;
  close: number;
  wrapped: boolean;
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
    pairs.push({ open, close: offset, wrapped: /[\r\n]/.test(expression) });
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

const displayFence = (value: string) => {
  let width = 2;
  for (const [dollars] of value.matchAll(/\$+/g)) width = Math.max(width, dollars.length + 1);
  return "$".repeat(width);
};

const displayLines = (sourceLines: string[], literals: SourceRange[]) => {
  let offset = 0;
  return sourceLines.map((line) => {
    const lineStart = offset;
    offset += line.length + 1;
    const [, indent = "", expression = ""] = singleLineDisplayPattern.exec(line) ?? [];
    if (expression.trim() && !literalAt(literals, lineStart, lineStart + line.length)) {
      const fence = displayFence(expression);
      return [`${indent}${fence}`, expression.trim(), `${indent}${fence}`];
    }
    return [line];
  });
};

const renderLegacyMath = (source: string[], normalized: string[][], pairs: DisplayPair[]) => {
  const lines: string[] = [];
  const fences: string[] = [];
  const standalone = new Map<number, string>();
  let next = 0;
  const appendNormalized = (end: number) => {
    for (; next < end; next++) {
      const row = normalized[next]!;
      if (row.length > 1)
        standalone.set(next, `${lines.length}:${row[0]!.indexOf("$")}:${lines.length + row.length - 1}`);
      lines.push(...row);
    }
  };
  for (const { open, close } of pairs) {
    appendNormalized(open.index);
    const body = source.slice(open.index + 1, close.index);
    const first = source[open.index]!.slice(open.offset + 2).trim();
    if (first) body.unshift(continuedPrefix(open.prefix) + first);
    const last = source[close.index]!.slice(0, close.offset).trimEnd();
    if (last.trim() !== close.prefix.trim()) body.push(last);

    const fence = displayFence(body.join("\n"));
    const start = lines.length;
    lines.push(`${open.prefix}${fence}`);
    for (const line of body) lines.push(line);
    fences.push(`${start}:${open.offset}:${lines.length}`);
    lines.push(`${continuedPrefix(close.prefix)}${fence}`);
    next = close.index + 1;
  }
  appendNormalized(normalized.length);
  return { markdown: lines.join("\n"), fences, standalone };
};

const recognizedDisplayFences = (tree: Root) => {
  const fences = new Set<string>();
  forEachChild(tree, (node) => {
    if (node.type !== "math" || !node.position) return;
    const closingLine = closingMathFenceLine(node);
    if (closingLine === undefined) return;
    const { start } = node.position;
    fences.add(`${start.line - 1}:${start.column - 1}:${closingLine - 1}`);
  });
  return fences;
};

type ParseMath = (markdown: string, matches?: ReadonlyMap<number, number>) => Root;

const matchInline = (markdown: string, { inlineBlocks, literals, autolinks }: ReturnType<typeof readSyntax>) =>
  inlineBlocks.flatMap((block) => inlinePairs(markdown, block, literals, autolinks));

const planDisplay = (markdown: string, syntax: ReturnType<typeof readSyntax>, inline: InlinePair[]) => {
  const source = markdown.split("\n");
  const matchedInline = new Set(inline.filter((pair) => !pair.wrapped).flatMap(({ open, close }) => [open, close]));
  const pairs = findDisplayPairs(source, syntax.paragraphs, syntax.literals, matchedInline);
  const lines = displayLines(source, syntax.literals);
  return { source, pairs, lines };
};

const validateDisplay = (plan: ReturnType<typeof planDisplay>, parse: ParseMath) => {
  const { source, pairs, lines } = plan;
  const rendered = renderLegacyMath(source, lines, pairs);
  if (!rendered.fences.length && !rendered.standalone.size) {
    return { ...plan, markdown: rendered.markdown, tree: undefined };
  }

  const tree = parse(rendered.markdown);
  const recognized = recognizedDisplayFences(tree);
  const accepted = pairs.filter((_, index) => recognized.has(rendered.fences[index]!));
  const standalone = lines.map((line, index) => {
    const fence = rendered.standalone.get(index);
    return fence === undefined || recognized.has(fence) ? line : [source[index]!];
  });
  if (accepted.length === pairs.length && standalone.every((line, index) => line === lines[index])) {
    return { ...plan, markdown: rendered.markdown, tree };
  }

  const fallback = renderLegacyMath(source, standalone, accepted);
  return { source, pairs: accepted, lines: standalone, markdown: fallback.markdown, tree: parse(fallback.markdown) };
};

const displaySourceRanges = ({ source, pairs, lines }: ReturnType<typeof validateDisplay>) => {
  const ends = new Map(pairs.map(({ open, close }) => [open.index, close.index]));
  const offsets = [0];
  for (const line of source) offsets.push(offsets.at(-1)! + line.length + 1);

  const ranges: SourceRange[] = [];
  for (let index = 0; index < source.length; index++) {
    const end = ends.get(index) ?? index;
    if (end > index || lines[index]!.length > 1) {
      ranges.push({ start: offsets[index]!, end: offsets[end + 1]! - 1 });
      index = end;
    }
  }
  return ranges;
};

export const parseLegacyInlineSource = (markdown: string, parse: ParseMath) => {
  const original = parse(markdown);
  if (!/\\[([]/.test(markdown)) return original;
  const syntax = readSyntax(markdown, original);
  const inline = matchInline(markdown, syntax);
  if (!inline.length) return original;
  // Keep original offsets while preventing display blocks from shifting the inline source ranges.
  const displays = markdown.includes("\\[")
    ? displaySourceRanges(validateDisplay(planDisplay(markdown, syntax, inline), parse))
    : [];
  const matches = inline.filter(({ open, close }) => !literalAt(displays, open, close + 2));
  return matches.length ? parse(markdown, new Map(matches.map(({ open, close }) => [open, close]))) : original;
};

export const inlineMathRanges = (tree: Root) => {
  const ranges: (SourceRange & { value: string })[] = [];
  forEachChild(tree, (node) => {
    if (node.type !== "inlineMath") return;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start !== undefined && end !== undefined) ranges.push({ start, end, value: node.value });
  });
  return ranges;
};

export const parseLegacyMath = (markdown: string, parse: ParseMath) => {
  // Markdown itself determines code spans and block boundaries before legacy delimiters are considered.
  const original = parse(markdown);
  if (!/\\[([]/.test(markdown)) return original;

  const syntax = readSyntax(markdown, original);
  const originalInline = matchInline(markdown, syntax);
  const display = validateDisplay(planDisplay(markdown, syntax, originalInline), parse);
  const input = display.markdown;
  const tree = display.tree ?? original;
  const inline = input === markdown ? originalInline : matchInline(input, readSyntax(input, tree));
  return inline.length ? parse(input, new Map(inline.map(({ open, close }) => [open, close]))) : tree;
};
