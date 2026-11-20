import { createSystem, defineConfig } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui/theme";

const config = defineConfig({
  theme: {
    keyframes: {
      "iso-fade-in": { from: { opacity: 0 }, to: { opacity: 1 } },
      "iso-puff": {
        to: { transform: "translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1.5)", opacity: 0 },
      },
      "iso-rise": {
        "0%": { transform: "translate(-50%, -50%) scale(.4)", opacity: 0 },
        "25%": { transform: "translate(-50%, -90%) scale(1.15)", opacity: 1 },
        "100%": { transform: "translate(-50%, -190%) scale(1)", opacity: 0 },
      },
      "iso-flash": { "30%": { filter: "brightness(1.35)" } },
      "rec-spin": { to: { transform: "rotate(360deg)" } },
      "rec-progress": { from: { width: "0%" }, to: { width: "100%" } },
      "rec-ripple": { from: { opacity: 0.9, transform: "scale(.3)" }, to: { opacity: 0, transform: "scale(1.4)" } },
    },
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
          accent: { value: "{colors.blue.500}" },
          ok: { value: "{colors.green.500}" },
        },
        agent: {
          claude: { value: "{colors.orange.500}" },
          codex: { value: "{colors.blue.500}" },
          opencode: { value: "{colors.blacks.500}" },
        },
      },
    },
  },
});

export const landingTheme = createSystem(psTheme._config, config);
