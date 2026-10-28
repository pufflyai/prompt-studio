import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig, withFilter } from "vite";

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const rootDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  experimental_indexers: async (indexers) => {
    const sourceIndexer = indexers.find((indexer) => indexer.test.test("example.stories.tsx"));
    if (!sourceIndexer) throw new Error("The preview test compiler has no source indexer");
    return [...indexers, { ...sourceIndexer, test: /\.canvas\.[tj]sx?$/ }];
  },
  stories: [
    "../src/**/*.canvas.@(js|jsx|mjs|ts|tsx)",
    "../../../.pstdio/extensions/canvas/src/**/*.canvas.tsx",
    "../../../.pstdio/extensions/social-radar/src/**/*.canvas.tsx",
    "../../../extensions/pstdio-artifacts/src/**/*.canvas.tsx",
    "../../../extensions/pstdio-planner/src/**/*.canvas.tsx",
  ],
  addons: [],
  framework: getAbsolutePath("@storybook/react-vite"),
  // Chakra's package.json declares a public Storybook URL. Composing it makes startup depend on the network.
  refs: { "@chakra-ui/react": { disable: true } },
  // This Storybook has no docs pages. Docgen would parse the linked @pstdio/ui and @pstdio/workbench bundles,
  // which made up most of the cold start time.
  typescript: { reactDocgen: false },
  viteFinal: async ({ plugins = [], ...config }) =>
    mergeConfig(config, {
      // Canvas previews are emitted JavaScript. Reapplying Babel to their minified dependency chunks
      // can mistake generated bindings for TypeScript declarations.
      plugins: withFilter(plugins, {
        pluginNamePattern: ["vite:react-babel"],
        transform: { id: { exclude: "**/.pstdio/extensions/canvas/src/catalog/generated/native/**" } },
      }),
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
