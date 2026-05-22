import { createWorkbenchCore } from "pstdio-workbench/core";
import { createBootstrapModule } from "./modules/bootstrap";
import { createSessionsModule } from "./modules/sessions/module";
import { createSettingsModule } from "./modules/settings/module";
import { createShellModule } from "./modules/shell/module";
import { createWorkspacesModule } from "./modules/workspaces/module";

export const createDashboardExampleModules = () => [
  createWorkspacesModule(),
  createSessionsModule(),
  createSettingsModule(),
  createShellModule(),
  createBootstrapModule(),
];

export const createDashboardWorkbench = () => {
  const workbench = createWorkbenchCore();
  for (const module of createDashboardExampleModules()) workbench.registerModule(module);
  return workbench;
};
