import "@pstdio/ui/style.css";

import { ChakraProvider, getInitialThemePreference, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AgentProvider } from "@/features/agents/state/AgentProvider";
import { SyncProvider } from "@/features/sync/sync-provider";
import { WorkspaceProvider } from "@/features/workspaces/state";
import "./i18n";
import { Router } from "./router";

const queryClient = new QueryClient();
const initialThemePreference = getInitialThemePreference();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemePreferenceProvider initialPreference={initialThemePreference}>
        <SyncProvider>
          <AgentProvider>
            <WorkspaceProvider>
              <ChakraProvider value={psTheme}>
                <Router />
              </ChakraProvider>
            </WorkspaceProvider>
          </AgentProvider>
        </SyncProvider>
      </ThemePreferenceProvider>
    </QueryClientProvider>
  </StrictMode>,
);
