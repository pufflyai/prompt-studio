import "@pstdio/ui/style.css";

import { ChakraProvider, getInitialThemePreference, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./i18n";
import { SyncProvider } from "@/features/sync/sync-provider";
import { Router } from "./router";
import { dashboardThemePreferences } from "./theme-preferences";

const queryClient = new QueryClient();
const initialThemePreference = getInitialThemePreference(dashboardThemePreferences);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemePreferenceProvider initialPreference={initialThemePreference} themePreferences={dashboardThemePreferences}>
        <SyncProvider>
          <ChakraProvider value={psTheme}>
            <Router />
          </ChakraProvider>
        </SyncProvider>
      </ThemePreferenceProvider>
    </QueryClientProvider>
  </StrictMode>,
);
