import type { DocBlock, DocPage } from "./doc-view";

const blockToMarkdown = (block: DocBlock) => {
  if (block.type === "heading") return `## ${block.text}`;
  if (block.type === "paragraph") return block.text;
  if (block.type === "list") return block.items.map((item) => `- ${item}`).join("\n");
  if (block.type === "code") return `\`\`\`${block.language ?? inferCodeLanguage(block.code)}\n${block.code}\n\`\`\``;
  if (block.type === "quote") return `> ${block.text}`;
  return `![${block.alt}](${block.src})`;
};

const inferCodeLanguage = (code: string) => {
  const trimmed = code.trim();
  if (/^(bun|pst|curl|cd|export)\b/m.test(trimmed)) return "bash";
  if (/^(\{|\[)/.test(trimmed) && /"[^"]+"\s*:/.test(trimmed)) return "json";
  if (/\b(import|export|const|defineExtension|async|interface)\b/.test(trimmed)) return "typescript";
  return "text";
};

export const docPageToMarkdown = (page: DocPage) =>
  [`# ${page.title}`, page.meta, page.intro, ...page.blocks.map(blockToMarkdown)].filter(Boolean).join("\n\n");
