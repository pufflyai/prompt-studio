import "@pstdio/ui/style.css";

import { Workbench } from "@pstdio/workbench/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SyncProvider } from "@/lib/sync/sync-provider";
import { createDashboardParamFieldRenderer } from "@/shared/command-params/dashboard-param-field";

import { createDashboardWorkbench } from "./workbench";
import "./i18n";

const dashboardWorkbench = createDashboardWorkbench();
const queryClient = new QueryClient();
const renderParamField = createDashboardParamFieldRenderer(dashboardWorkbench);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <Workbench workbench={dashboardWorkbench} renderParamField={renderParamField} />
      </SyncProvider>
    </QueryClientProvider>
  </StrictMode>,
);
