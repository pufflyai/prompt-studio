import "@pstdio/ui/style.css";

import { ChakraProvider, psTheme } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./i18n";
import { SyncProvider } from "@/lib/sync/sync-provider";
import { DashboardApp } from "./app";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ChakraProvider value={psTheme}>
        <SyncProvider>
          <DashboardApp />
        </SyncProvider>
      </ChakraProvider>
    </QueryClientProvider>
  </StrictMode>,
);
