import "@pstdio/ui/style.css";
import type { CanvasPreview } from "@pstdio/canvas";
import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { I18nextProvider } from "react-i18next";
import i18n from "../src/i18n/config";

// The host picks each frame's theme, so frames never store a theme choice.
const storage = { getItem: () => null, setItem: () => {} };

const preview: CanvasPreview = {
  decorators: [
    (Frame, { theme }) => (
      <I18nextProvider i18n={i18n}>
        <ChakraProvider value={psTheme}>
          <ThemePreferenceProvider initialPreference={theme.id} themePreferences={[theme]} storage={storage}>
            <Frame />
          </ThemePreferenceProvider>
        </ChakraProvider>
      </I18nextProvider>
    ),
  ],
};
export default preview;
