import type { Paragraph, PhrasingContent, Root, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { type InlineMath, mathFromMarkdown, mathToMarkdown } from "mdast-util-math";
import { type Handle, toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";
import { parseLegacyInlineSource, parseLegacyMath } from "./markdown-legacy-math";
import { dollarMath, legacyInlineMath } from "./markdown-math-syntax";

const parserOptions = {
  extensions: [gfm(), dollarMath],
  mdastExtensions: [gfmFromMarkdown(), mathFromMarkdown()],
};

const nativeMathSerializer = mathToMarkdown();
const toDollarMath = nativeMathSerializer.handlers?.inlineMath;
if (!toDollarMath) throw new Error("Markdown's inline math serializer is missing");

const canUseLegacyDelimiter = (value: string) =>
  value.trim() && !/[\r\n]|\\[()[\]]|\\$/.test(value) && !/(?:^|[^\\])(?:\\\\)*\$/.test(value);

const toInlineMath: Handle = (node: InlineMath, parent, state, info) => {
  const activeIndex = state.indexStack.at(-1) ?? 0;
  // The serializer also calls the next node's handler to inspect its first character.
  const index = parent?.children[activeIndex] === node ? activeIndex : activeIndex + 1;
  const previous = parent?.children[index - 1];
  const next = parent?.children[index + 1];

  if (previous?.type !== "inlineMath" && next?.type !== "inlineMath") return toDollarMath(node, parent, state, info);
  if (canUseLegacyDelimiter(node.value)) {
    const value = /^ .* $/s.test(node.value) ? ` ${node.value} ` : node.value;
    return `\\(${value}\\)`;
  }

  // Retain dollar syntax for expressions that already contain a legacy delimiter.
  const delimiterGap = next?.type === "inlineMath" && !canUseLegacyDelimiter(next.value) ? " " : "";
  return toDollarMath(node, parent, state, info) + delimiterGap;
};

const serializerOptions = {
  bullet: "-" as const,
  emphasis: "*" as const,
  extensions: [
    gfmToMarkdown(),
    { ...nativeMathSerializer, handlers: { ...nativeMathSerializer.handlers, inlineMath: toInlineMath } },
  ],
  fence: "`" as const,
  fences: true,
  listItemIndent: "one" as const,
  rule: "-" as const,
  strong: "*" as const,
};

const parseMatchedMath = (markdown: string, matches?: ReadonlyMap<number, number>) =>
  fromMarkdown(
    markdown,
    matches
      ? { ...parserOptions, extensions: [...parserOptions.extensions, legacyInlineMath(matches)] }
      : parserOptions,
  );

export const parseMarkdownSource = (markdown: string) => parseLegacyInlineSource(markdown, parseMatchedMath);

export const parseMarkdown = (markdown: string) => parseLegacyMath(markdown, parseMatchedMath);

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
