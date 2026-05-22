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
          { find: /^@pstdio\/ui\/style\.css$/, replacement: resolve(rootDir, "../../ui/dist/style.css") },
          { find: /^@\//, replacement: `${resolve(rootDir, "../../ui/src")}/` },
        ],
      },
    }),
};

export default config;
