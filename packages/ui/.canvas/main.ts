import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
const rootDir = dirname(fileURLToPath(import.meta.url));
const config: StorybookConfig = {
  experimental_indexers: async (indexers = []) => {
    const sourceIndexer = indexers.find((indexer) => indexer.test.test("example.stories.tsx"));
    if (!sourceIndexer) throw new Error("The preview test compiler has no source indexer");
    return [...indexers, { ...sourceIndexer, test: /\.canvas\.[tj]sx?$/ }];
  },
  stories: ["../src/**/*.mdx", "../src/**/*.canvas.@(js|jsx|mjs|ts|tsx)"],
  addons: [getAbsolutePath("@storybook/addon-docs")],
  framework: getAbsolutePath("@storybook/react-vite"),
  // Chakra's package.json declares a public Storybook URL. Composing it makes startup depend on the network.
  refs: { "@chakra-ui/react": { disable: true } },
  typescript: {
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      exclude: ["**/rich-text/shared/plugins/EquationPlugin/EquationPlugin.tsx"],
    },
  },
  viteFinal: async (config) =>
    mergeConfig(config, {
      resolve: {
        alias: {
          "@": resolve(rootDir, "../src"),
          $fonts: resolve(rootDir, "../public/font"),
        },
      },
    }),
};
export default config;
