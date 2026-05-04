import "@pstdio/ui/style.css";

import {
  ChakraProvider,
  customThemePreferences,
  defaultThemePreferences,
  getInitialThemePreference,
  isThemePreference,
  psTheme,
  ThemePreferenceProvider,
} from "@pstdio/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getThemePreferenceFromSearch } from "./host-bridge";
import { LabPage } from "./views/lab-page";
import "./styles.css";

export const labThemePreferences = [...defaultThemePreferences, ...customThemePreferences];

const routeThemePreference = getThemePreferenceFromSearch(window.location.search);
const initialThemePreference = isThemePreference(routeThemePreference, labThemePreferences)
  ? routeThemePreference
  : getInitialThemePreference(labThemePreferences);

const mount = document.getElementById("root");
if (!mount) {
  throw new Error("Extension Lab webview is missing its #root mount element.");
}

createRoot(mount).render(
  <StrictMode>
    <ThemePreferenceProvider initialPreference={initialThemePreference} themePreferences={labThemePreferences}>
      <ChakraProvider value={psTheme}>
        <LabPage />
      </ChakraProvider>
    </ThemePreferenceProvider>
  </StrictMode>,
);
