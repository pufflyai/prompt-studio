import { ChakraProvider } from "@chakra-ui/react";
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import { customThemePreferences, psTheme } from "../src/theme";
import {
  defaultThemePreferences,
  getThemePreferenceClassNames,
  isThemePreference,
  type ThemePreference,
} from "../src/utils/apply-theme-preference";
import { ThemePreferenceProvider } from "../src/utils/theme-preference";

const storybookThemePreferences = [...defaultThemePreferences, ...customThemePreferences];
const storybookThemes = Object.fromEntries(
  storybookThemePreferences.map((theme) => [theme.id, getThemePreferenceClassNames(theme.id, theme.mode).join(" ")]),
);

const resolveThemePreference = (theme: unknown): ThemePreference => {
  const value = typeof theme === "string" ? theme : "pstdio-light";
  return isThemePreference(value, storybookThemePreferences) ? value : "pstdio-light";
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
        <ThemePreferenceProvider
          key={themePreference}
          initialPreference={themePreference}
          themePreferences={storybookThemePreferences}
        >
          <ChakraProvider value={psTheme}>
            <Story />
          </ChakraProvider>
        </ThemePreferenceProvider>
      );
    },
    withThemeByClassName({
      defaultTheme: "pstdio-light",
      themes: storybookThemes,
    }),
  ],
};

export default preview;
