import { satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import type { HastPluginDefinition } from "satteri";

const links: HastPluginDefinition = {
  name: "heading-links",
  element: {
    filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
    visit(node, ctx) {
      const id = String(node.properties.id);
      ctx.appendChild(node, {
        type: "element",
        tagName: "a",
        properties: {
          href: `#${id}`,
          "data-heading-link": "",
          "aria-label": `Link to ${ctx.textContent(node)}`,
        },
        children: [],
      });
    },
  },
};

// Resolve Astro's IDs before adding links. Its final heading pass keeps these IDs.
export const headingLinks = [satteriHeadingIdsPlugin(), links];
