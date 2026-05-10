import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/onest/400.css";
import "@fontsource/onest/500.css";
import "@fontsource/onest/700.css";

export type { MonacoThemeData, VsCodeColorTheme } from "./custom";
export {
  createMonacoThemeFromVsCodeTheme,
  createThemePreferenceFromVsCodeTheme,
  customThemePreferences,
  monokaiThemePreference,
} from "./custom";
export { default as psTheme } from "./theme";
