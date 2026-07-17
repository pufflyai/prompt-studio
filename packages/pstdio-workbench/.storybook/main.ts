import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const rootDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: getAbsolutePath("@storybook/react-vite"),
  viteFinal: async (config) =>
    mergeConfig(config, {
      resolve: {
        alias: [
          { find: /^@pstdio\/ui$/, replacement: resolve(rootDir, "../../ui/src/index.ts") },
          { find: /^@pstdio\/ui\/chat-ui$/, replacement: resolve(rootDir, "../../ui/src/components/chat-ui/index.ts") },
          {
            find: /^@pstdio\/ui\/data-renderer$/,
            replacement: resolve(rootDir, "../../ui/src/components/data-renderer/index.ts"),
          },
          {
            find: /^@pstdio\/ui\/data-table$/,
            replacement: resolve(rootDir, "../../ui/src/components/data-table/index.ts"),
          },
          {
            find: /^@pstdio\/ui\/diff$/,
            replacement: resolve(rootDir, "../../ui/src/components/diff-viewer/index.ts"),
          },
          {
            find: /^@pstdio\/ui\/mermaid$/,
            replacement: resolve(rootDir, "../../ui/src/components/mermaid-renderer/index.ts"),
          },
          {
            find: /^@pstdio\/ui\/rich-text$/,
            replacement: resolve(rootDir, "../../ui/src/components/rich-text/index.ts"),
          },
          {
            find: /^@pstdio\/ui\/terminal$/,
            replacement: resolve(rootDir, "../../ui/src/components/terminal/index.ts"),
          },
          { find: /^@pstdio\/ui\/theme$/, replacement: resolve(rootDir, "../../ui/src/theme/index.ts") },
          { find: /^@pstdio\/ui\/style\.css$/, replacement: resolve(rootDir, "../../ui/dist/style.css") },
          { find: /^@\//, replacement: `${resolve(rootDir, "../../ui/src")}/` },
        ],
      },
    }),
};

export default config;
