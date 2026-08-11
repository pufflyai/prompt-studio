import "@pstdio/ui/style.css";

import { Workbench } from "@pstdio/workbench/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createDesktopWorkbenchStorage } from "@/lib/desktop-workbench-storage";
import { dashboardQueryClient } from "@/lib/query-client";
import { SyncProvider } from "@/lib/sync/sync-provider";
import { createDashboardParamFieldRenderer } from "@/shared/command-params/dashboard-param-field";

import { createDashboardWorkbench } from "./workbench";
import "./i18n";

const renderDashboard = async () => {
  const storage = await createDesktopWorkbenchStorage(window.promptStudioDesktop);
  const dashboardWorkbench = createDashboardWorkbench({ storage });
  (window as unknown as Record<string, unknown>).__pstdioDashboardWorkbench = dashboardWorkbench;
  const renderParamField = createDashboardParamFieldRenderer(dashboardWorkbench);

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={dashboardQueryClient}>
        <SyncProvider>
          <Workbench workbench={dashboardWorkbench} renderParamField={renderParamField} />
        </SyncProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
};

void renderDashboard();
