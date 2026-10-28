import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  experimental_indexers: async (indexers) => {
    const sourceIndexer = indexers.find((indexer) => indexer.test.test("example.stories.tsx"));
    if (!sourceIndexer) throw new Error("The preview test compiler has no source indexer");
    return [...indexers, { ...sourceIndexer, test: /\.canvas\.[tj]sx?$/ }];
  },
  stories: ["../stories/**/*.canvas.tsx"],
  framework: "@storybook/react-vite",
  refs: { "@chakra-ui/react": { disable: true } },
  typescript: { reactDocgen: false },
};

export default config;
