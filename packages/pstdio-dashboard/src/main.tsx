import "@pstdio/ui/style.css";

import { ChakraProvider, getInitialThemePreference, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SyncProvider } from "@/features/sync/sync-provider";
import "./i18n";
import { Router } from "./router";

const queryClient = new QueryClient();
const initialThemePreference = getInitialThemePreference();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemePreferenceProvider initialPreference={initialThemePreference}>
        <SyncProvider>
          <ChakraProvider value={psTheme}>
            <Router />
          </ChakraProvider>
        </SyncProvider>
      </ThemePreferenceProvider>
    </QueryClientProvider>
  </StrictMode>,
);
