import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const getAbsolutePath = (value: string) => dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));

const rootDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [],
  framework: getAbsolutePath("@storybook/react-vite"),
  viteFinal: async (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: {
        alias: {
          "@": resolve(rootDir, "../src"),
        },
      },
    }),
};

export default config;
