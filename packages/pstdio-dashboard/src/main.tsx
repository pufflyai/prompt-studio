import "@pstdio/ui/style.css";

import { ChakraProvider, getInitialThemePreference, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SyncProvider } from "@/features/sync/sync-provider";
import "./i18n";
import { Router } from "./router";

const initialThemePreference = getInitialThemePreference();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemePreferenceProvider initialPreference={initialThemePreference}>
      <SyncProvider>
        <ChakraProvider value={psTheme}>
          <Router />
        </ChakraProvider>
      </SyncProvider>
    </ThemePreferenceProvider>
  </StrictMode>,
);
