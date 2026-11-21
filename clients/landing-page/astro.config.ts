import { fileURLToPath } from "node:url";
import { satteri } from "@astrojs/markdown-satteri";
import react from "@astrojs/react";
import type { AstroIntegration } from "astro";
import { defineConfig } from "astro/config";
import { fetchDesktopRelease } from "./src/services/desktop-releases";
import { headingLinks } from "./src/services/markdown/heading-links";
import { pageSummary } from "./src/services/markdown/page-summary";
import { publishedLinks } from "./src/services/markdown/published-links";
import { readingTime } from "./src/services/markdown/reading-time";
import { themedImages } from "./src/services/markdown/themed-images";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

// Visitors' browsers refresh the release from GitHub, which allows 60 requests an hour per IP.
// A snapshot taken at build time keeps the download button working when they are rate limited.
const desktopReleaseSnapshot: AstroIntegration = {
  name: "desktop-release-snapshot",
  hooks: {
    "astro:config:setup": async ({ command, logger, updateConfig }) => {
      if (command !== "build") return;
      const release = await fetchDesktopRelease({
        signal: AbortSignal.timeout(15_000),
        token: process.env.GITHUB_TOKEN,
      }).catch((error: Error) => {
        logger.warn(`Building without a desktop release snapshot: ${error.message}`);
        return null;
      });
      if (release) logger.info(`Desktop release snapshot: v${release.version}`);
      updateConfig({ vite: { define: { __DESKTOP_RELEASE__: JSON.stringify(release) } } });
    },
  },
};

export default defineConfig({
  site: "https://prompt.studio",
  integrations: [react({ experimentalDisableStreaming: true }), desktopReleaseSnapshot],
  vite: {
    build: {
      rolldownOptions: {
        output: {
          // Keep startup's shared modules together instead of fetching many tiny files.
          codeSplitting: { groups: [{ name: "landing", tags: ["$initial"] }] },
        },
      },
    },
  },
  markdown: {
    processor: satteri({
      mdastPlugins: [publishedLinks(repoRoot), pageSummary, readingTime, themedImages],
      hastPlugins: headingLinks,
    }),
    // Code colors are CSS variables. The `landingDoc` recipe maps them to design
    // tokens, so code follows the color mode the page sets before it paints.
    shikiConfig: { theme: "css-variables" },
  },
});
