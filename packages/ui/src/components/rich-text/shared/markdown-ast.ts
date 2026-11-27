import type { Paragraph, PhrasingContent, Root, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { mathFromMarkdown, mathToMarkdown } from "mdast-util-math";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
import { math } from "micromark-extension-math";
import { parseLegacyMath } from "./markdown-legacy-math";

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

export const parseMarkdownSource = (markdown: string) => fromMarkdown(markdown, parserOptions);

export const parseMarkdown = (markdown: string) => parseLegacyMath(markdown, parseMarkdownSource);

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
