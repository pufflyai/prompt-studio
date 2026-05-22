import { Workbench } from "pstdio-workbench/react";
import { createDashboardWorkbench } from "./workbench/dashboard-workbench";

const dashboardWorkbench = createDashboardWorkbench();

export const App = () => {
  return <Workbench workbench={dashboardWorkbench} />;
};
