import {
  activateProductModule,
  createShellCore,
  type ProductModuleContribution,
  type ResourceRef,
} from "pstdio-shell/core";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

export const PROJECT_RESOURCE_KIND = "project";
export const PROJECT_SETTINGS_WIDGET_ID = "project.settings";
export const PROJECT_OPEN_SETTINGS_COMMAND_ID = "project.openSettings";
export const PROJECT_NAVIGATION_TREE_ID = "project.navigation";

interface DashboardProjectShellInput {
  projectId: string;
  projectName?: string;
  navigate: (path: string) => void;
}

const createProjectResource = (input: DashboardProjectShellInput): ResourceRef => ({
  kind: PROJECT_RESOURCE_KIND,
  uri: `pstdio://project/${input.projectId}`,
  id: input.projectId,
  label: input.projectName ?? "Project",
});

const createDashboardProjectModule = (input: DashboardProjectShellInput): ProductModuleContribution => ({
  id: "dashboard.project",
  activate(ctx) {
    const projectResource = createProjectResource(input);

    return [
      ctx.resources.registerKind({ kind: PROJECT_RESOURCE_KIND, label: "Project", icon: "folder" }),
      ctx.layout.registerWidget({
        id: PROJECT_SETTINGS_WIDGET_ID,
        title: "Project settings",
        area: "main",
        singleton: true,
        resourceKinds: [PROJECT_RESOURCE_KIND],
        renderer: "react",
        rendererId: PROJECT_SETTINGS_WIDGET_ID,
      }),
      ctx.resources.registerOpener({
        id: PROJECT_SETTINGS_WIDGET_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === PROJECT_RESOURCE_KIND,
        open: (resource) => {
          input.navigate(`/projects/${input.projectId}/settings`);
          return ctx.layout.openWidget(PROJECT_SETTINGS_WIDGET_ID, { resource });
        },
      }),
      ctx.commands.registerCommand(
        {
          id: PROJECT_OPEN_SETTINGS_COMMAND_ID,
          label: "Project settings",
          category: "Project",
          description: "Open project settings",
          icon: "settings",
        },
        {
          execute: () => ctx.resources.openResource(projectResource),
        },
      ),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: PROJECT_OPEN_SETTINGS_COMMAND_ID,
        label: "Project settings",
        icon: "settings",
        args: { projectId: input.projectId },
      }),
      ctx.trees.registerTreeView({
        id: PROJECT_NAVIGATION_TREE_ID,
        title: "Project",
        area: "left",
        icon: "folder",
        getRoots: () => [
          { id: input.projectId, label: projectResource.label ?? input.projectId, resource: projectResource },
        ],
        getChildren: () => [],
      }),
    ];
  },
});

export const createDashboardProjectShell = (input: DashboardProjectShellInput) => {
  const shell = createShellCore();
  const disposable = activateProductModule(shell, createDashboardProjectModule(input));

  return {
    ...shell,
    dispose: () => disposable.dispose(),
  };
};
