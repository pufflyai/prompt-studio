// @ts-check
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://prompt.studio",
  integrations: [react()],
  markdown: {
    shikiConfig: {
      theme: "github-dark",
      wrap: false,
    },
  },
});
