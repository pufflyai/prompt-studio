import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const getAbsolutePath = (value: string) => dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));

const rootDir = dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-themes"],
  framework: getAbsolutePath("@storybook/react-vite"),
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  viteFinal: async (config) =>
    mergeConfig(config, {
      resolve: {
        alias: {
          "@": resolve(rootDir, "../src"),
        },
      },
    }),
};

export default config;
