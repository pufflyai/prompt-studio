import "@pstdio/ui/style.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Workbench } from "pstdio-workbench/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SyncProvider } from "@/lib/sync/sync-provider";

import { createDashboardWorkbench } from "./workbench/dashboard-workbench";
import "./i18n";

const dashboardWorkbench = createDashboardWorkbench();
const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <Workbench workbench={dashboardWorkbench} />
      </SyncProvider>
    </QueryClientProvider>
  </StrictMode>,
);
