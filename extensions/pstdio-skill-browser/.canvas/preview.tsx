import type { CanvasPreview } from "@pstdio/canvas";
import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";

const storage = { getItem: () => null, setItem: () => {} };
const preview: CanvasPreview = {
  decorators: [
    (Frame, { theme }) => (
      <ChakraProvider value={psTheme}>
        <ThemePreferenceProvider initialPreference={theme.id} themePreferences={[theme]} storage={storage}>
          <Frame />
        </ThemePreferenceProvider>
      </ChakraProvider>
    ),
  ],
};
export default preview;
