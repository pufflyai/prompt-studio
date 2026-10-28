import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const packageDirectory = (name: string) => dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`)));

const config: StorybookConfig = {
  experimental_indexers: async (indexers = []) => {
    const sourceIndexer = indexers.find((indexer) => indexer.test.test("example.stories.tsx"));
    if (!sourceIndexer) throw new Error("The preview test compiler has no source indexer");
    return [...indexers, { ...sourceIndexer, test: /\.canvas\.[tj]sx?$/ }];
  },
  stories: ["../src/**/*.canvas.tsx"],
  addons: [packageDirectory("@storybook/addon-docs")],
  framework: packageDirectory("@storybook/react-vite"),
};

export default config;
