import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const rootDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [],
  framework: getAbsolutePath("@storybook/react-vite"),
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
