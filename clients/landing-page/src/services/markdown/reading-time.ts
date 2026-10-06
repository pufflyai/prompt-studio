import type { SatteriProcessorOptions } from "@astrojs/markdown-satteri";

type MdastPlugin = NonNullable<SatteriProcessorOptions["mdastPlugins"]>[number];
type TextBlock = Parameters<NonNullable<MdastPlugin["paragraph" | "heading" | "code" | "tableCell"]>>[0];
type VisitorContext = Parameters<NonNullable<MdastPlugin["paragraph"]>>[1];

const countWords = (node: TextBlock, ctx: VisitorContext) => {
  const frontmatter = ctx.data.astro?.frontmatter;
  if (!frontmatter) return;
  const words = ctx.textContent(node, { includeImageAlt: false, includeHtml: false }).match(/\S+/g)?.length ?? 0;
  const total = ((ctx.data.readingWords as number | undefined) ?? 0) + words;
  ctx.data.readingWords = total;
  frontmatter.readingMinutes = Math.max(1, Math.ceil(total / 220));
};

/** Estimate reading time from the article text at 220 words per minute. */
export const readingTime: MdastPlugin = {
  name: "reading-time",
  paragraph: countWords,
  heading: countWords,
  code: countWords,
  tableCell: countWords,
};
