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
import { TicketsListPage } from "./views/tickets-list-page";
import "./styles.css";

const ticketsThemePreferences = [...defaultThemePreferences, ...customThemePreferences];

const routeThemePreference = getThemePreferenceFromSearch(window.location.search);
const initialThemePreference = isThemePreference(routeThemePreference, ticketsThemePreferences)
  ? routeThemePreference
  : getInitialThemePreference(ticketsThemePreferences);

const mount = document.getElementById("root");
if (!mount) {
  throw new Error("Tickets list webview is missing its #root mount element.");
}

createRoot(mount).render(
  <StrictMode>
    <ThemePreferenceProvider initialPreference={initialThemePreference} themePreferences={ticketsThemePreferences}>
      <ChakraProvider value={psTheme}>
        <TicketsListPage />
      </ChakraProvider>
    </ThemePreferenceProvider>
  </StrictMode>,
);
