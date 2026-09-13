import { createSystem, defineConfig } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui/theme";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        illustration: {
          desktop: { value: "#FF6B1A" },
          page: { value: "#29ABE2" },
          command: { value: "#FBB040" },
          editor: { value: "#29ABE2" },
          skill: { value: "#E6357F" },
          hook: { value: "#E6357F" },
          automation: { value: "#F7931E" },
        },
      },
    },
  },
});

export const landingTheme = createSystem(psTheme._config, config);
