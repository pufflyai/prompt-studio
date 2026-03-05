import { ChakraProvider, getInitialThemePreference, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";

const initialThemePreference = getInitialThemePreference();

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
    (Story) => (
      <ThemePreferenceProvider initialPreference={initialThemePreference}>
        <ChakraProvider value={psTheme}>
          <Story />
        </ChakraProvider>
      </ThemePreferenceProvider>
    ),
    withThemeByClassName({
      defaultTheme: "light",
      themes: { light: "", dark: "dark" },
    }),
  ],
};

export default preview;
