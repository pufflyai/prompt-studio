import { Workbench } from "pstdio-workbench/react";
import { SyncProvider } from "@/lib/sync/sync-provider";
import { createDashboardWorkbench } from "./workbench/dashboard-workbench";

const dashboardWorkbench = createDashboardWorkbench();

export const App = () => {
  return (
    <SyncProvider>
      <Workbench workbench={dashboardWorkbench} />
    </SyncProvider>
  );
};
