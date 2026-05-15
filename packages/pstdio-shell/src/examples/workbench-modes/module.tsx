import type { ResourceRef, ShellCore, ShellModeActivationContext } from "../../core";
import { shellExampleResources, shellWidgetIds } from "../consumer/mock-data/data";
import { activateConsumerExample } from "../consumer/module";
import { LeftPanelHeader } from "./components/left-panel-header";
import { type LeftPanelMode, settingsResources, workspaceResources } from "./mock-data/data";

const LEFT_HEADER_WIDGET_ID = "workbench-modes.leftHeader";
const modePriority = { priority: 1000 };

const resolveLeftPanelMode = (resource: ResourceRef): LeftPanelMode => {
  if (resource.kind === "settings") return "settings";
  if (resource.kind === "workspace") return "workspace";
  return "project";
};

const resolveWidgetId = (resource: ResourceRef) => {
  if (resource.kind === "extension-review") return shellWidgetIds.extensionReview;
  if (resource.id === shellExampleResources.registryInventory.id) return shellWidgetIds.registryInventory;
  if (resource.kind === "ticket" || resource.kind === "dashboard-view") return shellWidgetIds.tickets;
  if (resource.kind === "workspace") return shellWidgetIds.workspace;
  if (resource.kind === "settings") return shellWidgetIds.settings;
  return shellWidgetIds.overview;
};

const activateWorkspaceMode = (ctx: ShellModeActivationContext) => [
  ctx.trees.registerTreeView(
    {
      id: "workspace.navigation",
      title: "Workspace navigation",
      area: "left",
      getRoots: () => [],
      getSections: () => [
        {
          id: "workspace",
          nodes: [
            {
              id: shellExampleResources.workspace.uri,
              label: "Overview",
              icon: "GitBranch",
              resource: shellExampleResources.workspace,
            },
            {
              id: workspaceResources.changes.uri,
              label: "Changed files",
              icon: "ListTree",
              resource: workspaceResources.changes,
            },
            {
              id: workspaceResources.checks.uri,
              label: "Checks",
              icon: "ListChecks",
              resource: workspaceResources.checks,
            },
          ],
        },
      ],
      getChildren: () => [],
    },
    modePriority,
  ),
  ctx.trees.registerTreeView(
    {
      id: "workspace.navigation.footer",
      title: "Workspace footer",
      area: "left",
      role: "footer",
      getRoots: () => [],
      getSections: () => [
        {
          id: "footer",
          nodes: [
            {
              id: shellExampleResources.tickets.uri,
              label: "Back to tickets",
              icon: "KanbanSquare",
              resource: shellExampleResources.tickets,
            },
            {
              id: shellExampleResources.settings.uri,
              label: "Project settings",
              icon: "Settings",
              resource: shellExampleResources.settings,
            },
          ],
        },
      ],
      getChildren: () => [],
    },
    modePriority,
  ),
];

const activateSettingsMode = (ctx: ShellModeActivationContext) => [
  ctx.trees.registerTreeView(
    {
      id: "project.settings.navigation",
      title: "Settings navigation",
      area: "left",
      getRoots: () => [],
      getSections: () => [
        {
          id: "project-settings",
          nodes: [
            {
              id: shellExampleResources.settings.uri,
              label: "Overview",
              icon: "Settings",
              resource: shellExampleResources.settings,
            },
            {
              id: settingsResources.templates.uri,
              label: "Templates",
              icon: "FileText",
              resource: settingsResources.templates,
            },
            {
              id: settingsResources.skills.uri,
              label: "Skills",
              icon: "Sparkles",
              resource: settingsResources.skills,
            },
            {
              id: settingsResources.statuses.uri,
              label: "Statuses",
              icon: "ListChecks",
              resource: settingsResources.statuses,
            },
          ],
        },
        {
          id: "workspace-settings",
          label: "Workspace",
          nodes: [
            {
              id: settingsResources.shortcuts.uri,
              label: "Shortcuts",
              icon: "Keyboard",
              resource: settingsResources.shortcuts,
            },
          ],
        },
      ],
      getChildren: () => [],
    },
    modePriority,
  ),
  ctx.trees.registerTreeView(
    {
      id: "project.settings.navigation.footer",
      title: "Settings footer",
      area: "left",
      role: "footer",
      getRoots: () => [],
      getSections: () => [
        {
          id: "footer",
          nodes: [
            {
              id: shellExampleResources.project.uri,
              label: "Back to project",
              icon: "KanbanSquare",
              resource: shellExampleResources.project,
            },
            {
              id: shellExampleResources.workspace.uri,
              label: "Open workspace",
              icon: "GitBranch",
              resource: shellExampleResources.workspace,
            },
          ],
        },
      ],
      getChildren: () => [],
    },
    modePriority,
  ),
];

const registerWorkbenchModes = (shell: ShellCore) => {
  shell.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  shell.modes.registerMode({ id: "workspace", label: "Workspace", activate: activateWorkspaceMode });
  shell.modes.registerMode({ id: "settings", label: "Settings", activate: activateSettingsMode });
};

const registerLeftHeader = (shell: ShellCore) => {
  shell.layout.registerWidget({
    id: LEFT_HEADER_WIDGET_ID,
    title: "Mode switcher",
    area: "left-header",
    singleton: true,
    renderer: "react",
    rendererId: LEFT_HEADER_WIDGET_ID,
  });
  shell.renderers.registerRenderer({
    id: LEFT_HEADER_WIDGET_ID,
    render: (input) => <LeftPanelHeader shell={input.shell} />,
  });
  shell.layout.openWidget(LEFT_HEADER_WIDGET_ID, { pinned: true, closable: false });
};

const registerPanelModeResourceOpener = (shell: ShellCore) => {
  shell.resources.registerOpener({
    id: "workbench-modes.resourceOpener",
    priority: 1000,
    canOpen: (resource) =>
      ["project", "dashboard-view", "ticket", "workspace", "settings", "extension-review"].includes(resource.kind),
    open: (resource, input) => {
      shell.modes.setActiveMode(resolveLeftPanelMode(resource));
      return shell.layout.openWidget(resolveWidgetId(resource), {
        resource,
        title: resource.label,
        replaceActive: input.replaceActive,
      });
    },
  });
};

export const activateWorkbenchModesExample = (shell: ShellCore) => {
  activateConsumerExample(shell);
  registerWorkbenchModes(shell);
  registerLeftHeader(shell);
  registerPanelModeResourceOpener(shell);
  shell.modes.setActiveMode("project");
};
