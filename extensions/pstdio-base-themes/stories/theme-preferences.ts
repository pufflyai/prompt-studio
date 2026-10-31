import { createThemePreferenceFromVsCodeTheme } from "@pstdio/ui";
import dracula from "../themes/dracula-color-theme.json";
import monokai from "../themes/monokai-color-theme.json";
import solarizedDark from "../themes/solarized-dark-color-theme.json";
import solarizedLight from "../themes/solarized-light-color-theme.json";

// Use shipped assets, including the app roles read by the extension runtime importer.
export const themePreferences = [
  { id: "solarized-light", mode: "light", theme: solarizedLight },
  { id: "solarized-dark", mode: "dark", theme: solarizedDark },
  { id: "dracula", mode: "dark", theme: dracula },
  { id: "monokai", mode: "dark", theme: monokai },
].map(({ id, mode, theme }) => {
  const preference = createThemePreferenceFromVsCodeTheme({ id, mode: mode as "light" | "dark", theme });
  return { ...preference, title: theme.name };
});
