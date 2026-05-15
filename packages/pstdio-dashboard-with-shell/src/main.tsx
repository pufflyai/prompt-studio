import "@pstdio/ui/style.css";

import { ChakraProvider, getInitialThemePreference, psTheme, ThemePreferenceProvider, Toaster } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SyncProvider } from "@/lib/sync";
import { dashboardThemePreferences } from "./lib/theme/theme-preferences";
import { DashboardShell } from "./shell";

if (import.meta.env.DEV && import.meta.env.VITE_REACT_SCAN === "1") {
  const { scan } = await import("react-scan");
  scan();
}

const queryClient = new QueryClient();
const initialThemePreference = getInitialThemePreference(dashboardThemePreferences);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemePreferenceProvider initialPreference={initialThemePreference} themePreferences={dashboardThemePreferences}>
        <SyncProvider>
          <ChakraProvider value={psTheme}>
            <DashboardShell />
            <Toaster />
          </ChakraProvider>
        </SyncProvider>
      </ThemePreferenceProvider>
    </QueryClientProvider>
  </StrictMode>,
);
