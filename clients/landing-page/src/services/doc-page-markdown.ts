import type { DocBlock, DocPage } from "../content/legal";

const blockToMarkdown = (block: DocBlock) => {
  if (block.type === "heading") return `## ${block.text}`;
  if (block.type === "paragraph") return block.text;
  return block.items.map((item) => `- ${item}`).join("\n");
};

export const docPageToMarkdown = (page: DocPage) =>
  [`# ${page.title}`, page.meta, page.intro, ...page.blocks.map(blockToMarkdown)].filter(Boolean).join("\n\n");
