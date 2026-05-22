import { createWorkbenchCore } from "../../core";
import { createBootstrapModule } from "./modules/bootstrap";
import { createSessionsModule } from "./modules/sessions/module";
import { createSettingsModule } from "./modules/settings/module";
import { createShellModule } from "./modules/shell/module";
import { createDashboardCollectionPersistence } from "./modules/tickets/collections/persistence";
import { createTicketsModule } from "./modules/tickets/module";
import { createWorkspacesModule } from "./modules/workspaces/module";

// The dashboard example is composed of vertical feature slices, each an
// independent WorkbenchModuleContribution. Array order is activation order, so
// `bootstrap` runs last once every slice has registered its surfaces.
export const createDashboardExampleModules = () => [
  createTicketsModule(),
  createWorkspacesModule(),
  createSessionsModule(),
  createSettingsModule(),
  createShellModule(),
  createBootstrapModule(),
];

export const createDashboardWorkbench = () => {
  const workbench = createWorkbenchCore(createDashboardCollectionPersistence());
  for (const module of createDashboardExampleModules()) workbench.registerModule(module);
  return workbench;
};
