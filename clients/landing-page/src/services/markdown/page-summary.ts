import type { MdastPluginDefinition as MdastPlugin } from "satteri";

/**
 * Docs pages carry no frontmatter. Their meta description is the first paragraph
 * after the `#` title, as plain text, stored in the frontmatter as `description`.
 */
export const pageSummary: MdastPlugin = {
  name: "page-summary",
  heading(node, ctx) {
    if (node.depth === 1) ctx.data.titleSeen = true;
  },
  paragraph(node, ctx) {
    const frontmatter = ctx.data.astro?.frontmatter;
    if (!frontmatter || !ctx.data.titleSeen || frontmatter.description !== undefined) return;
    if (ctx.parent(node)?.type !== "root") return;
    frontmatter.description = ctx.textContent(node).replace(/\s+/g, " ").trim();
  },
};
