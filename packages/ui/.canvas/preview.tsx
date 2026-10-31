import { ChakraProvider } from "@chakra-ui/react";
import type { CanvasPreview } from "@pstdio/canvas";
import { psTheme } from "@/theme";
import { canvasVsCodeThemes } from "@/theme/custom/vscode-theme.canvas-fixture";
import { defaultThemePreferences } from "@/utils/apply-theme-preference";
import { ThemePreferenceProvider } from "@/utils/theme-preference";

// The host picks each frame's theme, so frames never store a theme choice.
const storage = { getItem: () => null, setItem: () => {} };
// UI Canvas knows the built-in themes. For the imported-palette examples it sends only the id,
// and this project supplies their colors.
const projectThemes = [...defaultThemePreferences, ...canvasVsCodeThemes];

const preview: CanvasPreview = {
  decorators: [
    (Frame, { theme }) => {
      const option = theme.tokens ? theme : (projectThemes.find((entry) => entry.id === theme.id) ?? theme);
      return (
        <ChakraProvider value={psTheme}>
          <ThemePreferenceProvider initialPreference={option.id} themePreferences={[option]} storage={storage}>
            <Frame />
          </ThemePreferenceProvider>
        </ChakraProvider>
      );
    },
  ],
};
export default preview;
