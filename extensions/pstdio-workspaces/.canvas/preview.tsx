import "@pstdio/ui/style.css";
import { ChakraProvider } from "@chakra-ui/react";
import type { CanvasPreview } from "@pstdio/canvas";
import { psTheme, ThemePreferenceProvider } from "@pstdio/ui";

const preview: CanvasPreview = {
  decorators: [
    (Frame, { theme }) => (
      <ChakraProvider value={psTheme}>
        <ThemePreferenceProvider
          initialPreference={theme.id}
          themePreferences={[theme]}
          storage={{ getItem: () => null, setItem: () => {} }}
        >
          <Frame />
        </ThemePreferenceProvider>
      </ChakraProvider>
    ),
  ],
};
export default preview;
