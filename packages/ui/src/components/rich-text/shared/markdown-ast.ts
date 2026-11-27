import type { Paragraph, PhrasingContent, Root, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown, mathToMarkdown } from "mdast-util-math";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";

const parserOptions = {
  extensions: [gfm(), math()],
  mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
};

const serializerOptions = {
  bullet: "-" as const,
  emphasis: "*" as const,
  extensions: [gfmToMarkdown(), mathToMarkdown()],
  fence: "`" as const,
  fences: true,
  listItemIndent: "one" as const,
  rule: "-" as const,
  strong: "*" as const,
};

const fenceStart = (line: string) => line.match(/^ {0,3}(`{3,}|~{3,})/);

const normalizeLegacyMathLine = (line: string) => {
  // Backslash escapes inside the expression may carry literal backslashes but no second bracket delimiter.
  const displayMath = line.match(/^( {0,3})\\\[((?:[^\\]|\\[^[\]])*)\\\][ \t]*\r?$/);
  if (displayMath) {
    const [, indentation, expression] = displayMath;
    return `${indentation}$$\n${expression!.trim()}\n${indentation}$$`;
  }

  let codeFenceLength = 0;
  let bracketStart: number | undefined;
  let nextIndex = 0;
  const result: string[] = [];

  for (const match of line.matchAll(/`+|\\[\\()[\]]/g)) {
    const [token] = match;
    result.push(line.slice(nextIndex, match.index));
    nextIndex = match.index + token.length;

    if (token.startsWith("`")) {
      if (!codeFenceLength) codeFenceLength = token.length;
      else if (codeFenceLength === token.length) codeFenceLength = 0;
      result.push(token);
      continue;
    }
    if (codeFenceLength) {
      result.push(token);
      continue;
    }

    switch (token) {
      case "\\(":
      case "\\)":
        result.push("$");
        break;
      case "\\[":
        bracketStart = result.length;
        result.push(token);
        break;
      case "\\]": {
        if (bracketStart === undefined) {
          result.push(token);
          break;
        }
        result[bracketStart] = "$$";
        result.push("$$");
        bracketStart = undefined;
        break;
      }
      default:
        result.push(token);
    }
  }

  result.push(line.slice(nextIndex));
  return result.join("");
};

const quotePrefix = /^(?: {0,3}>[ \t]?)+/;

const legacyMathFence = (line: string) => {
  const match = line.match(/^([ \t]*)((?:[-+*]|\d{1,9}[.)])[ \t]+)?\\(\[|\])[ \t]*\r?$/);
  if (!match) return undefined;

  const [, indent = "", listMarker = "", bracket] = match;
  if (listMarker && bracket === "]") return undefined;

  return { bracket, indentation: indent.length + listMarker.length };
};

const normalizeLegacyMath = (markdown: string) => {
  let fencedCode: { character: string; length: number } | null = null;
  let displayMathStart: { lineIndex: number; quoteDepth: number; indentation: number } | undefined;
  const normalized: string[] = [];

  for (const line of markdown.split("\n")) {
    if (fencedCode) {
      normalized.push(line);
      const closingFence = line.match(/^ {0,3}(`+|~+)[ \t]*$/)?.[1];
      if (closingFence?.[0] === fencedCode.character && closingFence.length >= fencedCode.length) {
        fencedCode = null;
      }
      continue;
    }

    const openingFence = fenceStart(line)?.[1];
    if (openingFence) {
      fencedCode = { character: openingFence[0] ?? "`", length: openingFence.length };
      displayMathStart = undefined;
      normalized.push(line);
      continue;
    }

    const quote = quotePrefix.exec(line)?.[0] ?? "";
    const quoteDepth = quote.replace(/[^>]/g, "").length;
    if (displayMathStart && quoteDepth < displayMathStart.quoteDepth) displayMathStart = undefined;

    const fence = legacyMathFence(line.slice(quote.length));
    if (fence?.bracket === "[") {
      displayMathStart = { quoteDepth, indentation: fence.indentation, lineIndex: normalized.length };
    } else if (
      fence?.bracket === "]" &&
      displayMathStart?.quoteDepth === quoteDepth &&
      Math.abs(displayMathStart.indentation - fence.indentation) <= 3
    ) {
      // An unmatched dollar fence would make the rest of the document math.
      const { lineIndex } = displayMathStart;
      normalized[lineIndex] = normalized[lineIndex]!.replace("\\[", () => "$$");
      normalized.push(line.replace("\\]", () => "$$"));
      displayMathStart = undefined;
      continue;
    }

    normalized.push(normalizeLegacyMathLine(line));
  }

  return normalized.join("\n");
};

export const parseMarkdown = (markdown: string) => fromMarkdown(normalizeLegacyMath(markdown), parserOptions);

export const parseMarkdownSource = (markdown: string) => fromMarkdown(markdown, parserOptions);

export const serializeMarkdownAst = (tree: Root) => toMarkdown(tree, serializerOptions).trimEnd();

export const serializeMarkdownBlock = (node: RootContent) => serializeMarkdownAst({ type: "root", children: [node] });

export const serializeMarkdownInline = (children: PhrasingContent[]) => {
  const paragraph: Paragraph = { type: "paragraph", children };
  return serializeMarkdownBlock(paragraph);
};

export const parseMarkdownInline = (markdown: string) => {
  const tree = parseMarkdown(markdown);
  const first = tree.children[0];

  return first?.type === "paragraph" || first?.type === "heading" ? first.children : [];
};
