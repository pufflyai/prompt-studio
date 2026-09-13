import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const packageDirectory = (name: string) => dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`)));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  addons: [packageDirectory("@storybook/addon-docs")],
  framework: packageDirectory("@storybook/react-vite"),
};

export default config;
