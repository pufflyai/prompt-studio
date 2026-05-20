import { type CreateWorkbenchRendererRegistryInput, createWorkbenchCore } from "pstdio-workbench/core";
import { createExtensionsModule } from "@/modules/extensions/extensions-module";
import { createNavigationModule } from "@/modules/navigation/navigation-module";
import { createProjectModule } from "@/modules/project/project-module";
import { createSessionsModule } from "@/modules/sessions/sessions-module";
import { createSettingsModule } from "@/modules/settings/settings-module";
import { createTicketsModule } from "@/modules/tickets/tickets-module";
import { createWorkspacesModule } from "@/modules/workspaces/workspaces-module";
import {
  createDashboardLayoutPersistence,
  createDashboardPanelsPersistence,
  projectLayoutScope,
} from "./persistence/workbench-persistence";

export interface CreateDashboardWorkbenchOptions {
  // Renderer registry overrides. Headless callers (tests, SSR) pass a custom
  // `createHost` so keep-alive renderers can register without a DOM.
  renderers?: CreateWorkbenchRendererRegistryInput;
}

// Creates the workbench-first dashboard for a single project. Surface modules
// are registered first so the project bootstrap module can open widgets they
// contributed. Layout and panel state persist under a `project:${projectId}`
// scope so each project keeps its own arrangement.
export const createDashboardWorkbench = (projectId: string, options: CreateDashboardWorkbenchOptions = {}) => {
  const scope = projectLayoutScope(projectId);

  const workbench = createWorkbenchCore({
    layoutPersistence: createDashboardLayoutPersistence(),
    panelsPersistence: createDashboardPanelsPersistence(scope),
    initialSessionPanelMode: "closed",
    renderers: options.renderers,
  });

  workbench.layout.setPersistenceScope(scope);

  workbench.registerModule(createNavigationModule());
  workbench.registerModule(createTicketsModule(projectId));
  workbench.registerModule(createWorkspacesModule(projectId));
  workbench.registerModule(createSessionsModule(projectId));
  workbench.registerModule(createSettingsModule(projectId));
  workbench.registerModule(createExtensionsModule());
  workbench.registerModule(createProjectModule(projectId));

  return workbench;
};
