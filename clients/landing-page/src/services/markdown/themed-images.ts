import type { MdastPluginDefinition as MdastPlugin } from "satteri";

// Mark source names before Astro replaces them with hashed asset URLs.
export const themedImages: MdastPlugin = {
  name: "themed-images",
  image(node, ctx) {
    const tone = node.url.match(/-(light|dark)\.gif$/)?.[1];
    if (!tone) return;
    ctx.setProperty(node, "data", {
      ...node.data,
      hProperties: { "data-art-tone": tone },
    });
  },
};
