import "@pstdio/ui/style.css";
import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import type { Preview } from "@storybook/react-vite";
import { themePreferences } from "../stories/theme-preferences";

const previewStorage = { getItem: () => null, setItem: () => {} };

const preview: Preview = {
  initialGlobals: { theme: "solarized-light" },
  globalTypes: {
    theme: {
      description: "Theme for the single-theme preview; comparison columns always show all four themes.",
      toolbar: {
        icon: "paintbrush",
        items: themePreferences.map((theme) => ({ value: theme.id, title: theme.title })),
      },
    },
  },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, context) => (
      <ThemePreferenceProvider
        key={context.globals.theme}
        initialPreference={context.globals.theme}
        themePreferences={themePreferences}
        storage={previewStorage}
      >
        <ChakraProvider value={psTheme}>
          <Story />
        </ChakraProvider>
      </ThemePreferenceProvider>
    ),
  ],
};

export default preview;
