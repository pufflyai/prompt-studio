import { fileURLToPath } from "node:url";
import { satteri } from "@astrojs/markdown-satteri";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import { pageSummary } from "./src/services/markdown/page-summary";
import { publishedLinks } from "./src/services/markdown/published-links";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  site: "https://prompt.studio",
  integrations: [react()],
  markdown: {
    processor: satteri({ mdastPlugins: [publishedLinks(repoRoot), pageSummary] }),
    // Code colors are CSS variables. The `landingDoc` recipe maps them to design
    // tokens, so code follows the color mode the page sets before it paints.
    shikiConfig: { theme: "css-variables" },
  },
});
