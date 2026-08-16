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

const normalizeLegacyInlineMath = (line: string) => {
  let codeFenceLength: number | null = null;
  let result = "";

  for (let index = 0; index < line.length; ) {
    if (line[index] === "`") {
      let end = index;
      while (line[end] === "`") end += 1;
      const length = end - index;

      if (codeFenceLength === null) codeFenceLength = length;
      else if (codeFenceLength === length) codeFenceLength = null;

      result += line.slice(index, end);
      index = end;
      continue;
    }

    const delimiter = line.slice(index, index + 2);
    if (codeFenceLength === null && (delimiter === "\\(" || delimiter === "\\)")) {
      result += "$";
      index += 2;
      continue;
    }
    if (codeFenceLength === null && (delimiter === "\\[" || delimiter === "\\]")) {
      result += "$$";
      index += 2;
      continue;
    }

    result += line[index];
    index += 1;
  }

  return result;
};

const normalizeLegacyMath = (markdown: string) => {
  let fencedCode: { character: string; length: number } | null = null;
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
      normalized.push(line);
      continue;
    }

    const displayMath = line.match(/^( {0,3})\\\[\s*(.*?)\s*\\\][ \t]*$/);
    if (displayMath) {
      const indent = displayMath[1] ?? "";
      normalized.push(`${indent}$$`, displayMath[2] ?? "", `${indent}$$`);
      continue;
    }

    if (/^ {0,3}\\\[[ \t]*$/.test(line)) {
      normalized.push(line.replace("\\[", () => "$$"));
      continue;
    }
    if (/^ {0,3}\\\][ \t]*$/.test(line)) {
      normalized.push(line.replace("\\]", () => "$$"));
      continue;
    }

    normalized.push(normalizeLegacyInlineMath(line));
  }

  return normalized.join("\n");
};

export const parseMarkdown = (markdown: string) => fromMarkdown(normalizeLegacyMath(markdown), parserOptions);

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
