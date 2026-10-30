import { ChakraProvider } from "@chakra-ui/react";
import type { CanvasPreview } from "@pstdio/canvas";
import { psTheme } from "@/theme";
import { ThemePreferenceProvider } from "@/utils/theme-preference";

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
