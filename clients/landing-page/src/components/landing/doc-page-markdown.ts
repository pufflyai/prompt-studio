import type { DocBlock, DocPage } from "./doc-view";

const blockToMarkdown = (block: DocBlock) => {
  if (block.type === "heading") return `## ${block.text}`;
  if (block.type === "paragraph") return block.text;
  if (block.type === "list") return block.items.map((item) => `- ${item}`).join("\n");
  if (block.type === "code") return `\`\`\`\n${block.code}\n\`\`\``;
  if (block.type === "quote") return `> ${block.text}`;
  return `![${block.alt}](${block.src})`;
};

export const docPageToMarkdown = (page: DocPage) =>
  [`# ${page.title}`, page.meta, page.intro, ...page.blocks.map(blockToMarkdown)].filter(Boolean).join("\n\n");
