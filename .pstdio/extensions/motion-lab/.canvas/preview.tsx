import type { CanvasPreview } from "@pstdio/canvas";
import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";

const preview: CanvasPreview = {
  decorators: [
    (Frame, { theme }) => (
      <ChakraProvider value={psTheme}>
        <ThemePreferenceProvider initialPreference={theme.id} themePreferences={[theme]}>
          <Frame />
        </ThemePreferenceProvider>
      </ChakraProvider>
    ),
  ],
};
export default preview;
