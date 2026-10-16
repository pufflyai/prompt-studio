import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.tsx"],
  framework: "@storybook/react-vite",
  refs: { "@chakra-ui/react": { disable: true } },
  typescript: { reactDocgen: false },
};

export default config;
