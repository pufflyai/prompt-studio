import "@pstdio/ui/style.css";

import { ChakraProvider, getInitialThemePreference, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./i18n";
import { Router } from "./router";

const queryClient = new QueryClient();
const showDevtools = import.meta.env.VITE_SHOW_DEV_TOOLS === "false";
const initialThemePreference = getInitialThemePreference();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemePreferenceProvider initialPreference={initialThemePreference}>
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={psTheme}>
          <Router />
        </ChakraProvider>
        {showDevtools ? <ReactQueryDevtools buttonPosition="bottom-right" initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </ThemePreferenceProvider>
  </StrictMode>,
);
