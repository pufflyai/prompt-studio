import "@pstdio/ui/style.css";

import { Toaster } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkbenchThemePreferences, Workbench, WorkbenchThemeProvider } from "pstdio-workbench/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SyncProvider } from "@/lib/sync/sync-provider";

import { createDashboardWorkbench } from "./workbench/dashboard-workbench";
import "./i18n";

const dashboardWorkbench = createDashboardWorkbench();
const queryClient = new QueryClient();

const DashboardWorkbenchApp = () => {
  const themePreferences = useWorkbenchThemePreferences(dashboardWorkbench);

  return (
    <WorkbenchThemeProvider themePreferences={themePreferences}>
      <Workbench workbench={dashboardWorkbench} />
      <Toaster />
    </WorkbenchThemeProvider>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <DashboardWorkbenchApp />
      </SyncProvider>
    </QueryClientProvider>
  </StrictMode>,
);
