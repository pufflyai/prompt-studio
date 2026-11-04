import "@pstdio/ui/style.css";
import type { CanvasPreview } from "@pstdio/canvas";
import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";

export default {
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
} satisfies CanvasPreview;
