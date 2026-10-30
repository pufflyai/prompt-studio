import "@pstdio/ui/style.css";
import type { CanvasPreview } from "@pstdio/canvas";
import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";

// The host picks each frame's theme, so frames never store a theme choice.
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
