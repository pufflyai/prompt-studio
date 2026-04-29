import { ChakraProvider } from "@chakra-ui/react";
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import { psTheme } from "../src/theme";
import { isThemePreference, type ThemePreference } from "../src/utils/apply-theme-preference";
import { ThemePreferenceProvider } from "../src/utils/theme-preference";

const resolveThemePreference = (theme: unknown): ThemePreference => {
  const value = typeof theme === "string" ? theme : "pstdio-light";
  return isThemePreference(value) ? value : "pstdio-light";
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const themePreference = resolveThemePreference(context.globals.theme);

      return (
        <ThemePreferenceProvider key={themePreference} initialPreference={themePreference}>
          <ChakraProvider value={psTheme}>
            <Story />
          </ChakraProvider>
        </ThemePreferenceProvider>
      );
    },
    withThemeByClassName({
      defaultTheme: "pstdio-light",
      themes: {
        "pstdio-light": "light theme-pstdio-light",
        "pstdio-dark": "dark theme-pstdio-dark",
        monokai: "dark theme-monokai",
      },
    }),
  ],
};

export default preview;
