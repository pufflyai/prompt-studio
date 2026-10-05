import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const rootDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../../../extensions/pstdio-artifacts/src/**/*.stories.tsx",
    "../../../extensions/pstdio-planner/src/**/*.stories.tsx",
  ],
  addons: [],
  framework: getAbsolutePath("@storybook/react-vite"),
  // Chakra's package.json declares a public Storybook URL. Composing it makes startup depend on the network.
  refs: { "@chakra-ui/react": { disable: true } },
  // This Storybook has no docs pages. Docgen would parse the linked @pstdio/ui and @pstdio/workbench bundles,
  // which made up most of the cold start time.
  typescript: { reactDocgen: false },
  viteFinal: async (config) =>
    mergeConfig(config, {
      resolve: {
        // Extension stories also import released UI and SDK versions. The dashboard owns this preview's UI
        // contract, and @pstdio/ui reads runtime values from the SDK, so both must be the workspace copies.
        dedupe: ["@pstdio/ui", "@pstdio/sdk"],
        alias: {
          "@": resolve(rootDir, "../src"),
          $fonts: resolve(rootDir, "../public/font"),
        },
      },
    }),
};

export default config;
