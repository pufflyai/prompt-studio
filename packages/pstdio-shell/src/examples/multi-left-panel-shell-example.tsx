import { HStack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { ResourceRef, ShellCore } from "../core";
import { ShellIcon, ShellWorkbench } from "../react";
import { createConsumerShellExample } from "./consumer-shell-example";
import { commandPaletteMenuPath, shellExampleResources, shellWidgetIds } from "./consumer-shell-example-data";

type LeftPanelMode = "project" | "workspace" | "settings";

interface LeftPanelSetup {
  treeViewId: string;
  footerTreeViewId?: string;
  title: string;
  icon: string;
}

const workspaceNavigationTreeViewId = "workspace.navigation";
const workspaceFooterTreeViewId = "workspace.navigation.footer";
const settingsNavigationTreeViewId = "project.settings.navigation";
const settingsFooterTreeViewId = "project.settings.navigation.footer";

const leftPanelSetups = {
  project: {
    treeViewId: "project.navigation",
    footerTreeViewId: "project.navigation.footer",
    title: "Prompt Studio",
    icon: "FolderGit2",
  },
  workspace: {
    treeViewId: workspaceNavigationTreeViewId,
    footerTreeViewId: workspaceFooterTreeViewId,
    title: "Workspace",
    icon: "GitBranch",
  },
  settings: {
    treeViewId: settingsNavigationTreeViewId,
    footerTreeViewId: settingsFooterTreeViewId,
    title: "Project settings",
    icon: "Settings",
  },
} satisfies Record<LeftPanelMode, LeftPanelSetup>;

const workspaceResources = {
  changes: {
    kind: "workspace",
    uri: "pstdio://workspace/workspace-ps-266/changes",
    id: "workspace-ps-266-changes",
    label: "Changed files",
    icon: "ListTree",
  },
  checks: {
    kind: "workspace",
    uri: "pstdio://workspace/workspace-ps-266/checks",
    id: "workspace-ps-266-checks",
    label: "Checks",
    icon: "ListChecks",
  },
} satisfies Record<string, ResourceRef>;

const settingsResources = {
  templates: {
    kind: "settings",
    uri: "pstdio://settings/project-settings/templates",
    id: "project-settings-templates",
    label: "Templates",
    icon: "FileText",
  },
  skills: {
    kind: "settings",
    uri: "pstdio://settings/project-settings/skills",
    id: "project-settings-skills",
    label: "Skills",
    icon: "Sparkles",
  },
  statuses: {
    kind: "settings",
    uri: "pstdio://settings/project-settings/statuses",
    id: "project-settings-statuses",
    label: "Statuses",
    icon: "ListChecks",
  },
  shortcuts: {
    kind: "settings",
    uri: "pstdio://settings/project-settings/shortcuts",
    id: "project-settings-shortcuts",
    label: "Shortcuts",
    icon: "Keyboard",
  },
} satisfies Record<string, ResourceRef>;

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

const registerWorkspaceNavigation = (shell: ShellCore) => {
  shell.trees.registerTreeView({
    id: workspaceNavigationTreeViewId,
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
  });

  shell.trees.registerTreeView({
    id: workspaceFooterTreeViewId,
    title: "Workspace footer",
    area: "left",
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
  });
};

const registerSettingsNavigation = (shell: ShellCore) => {
  shell.trees.registerTreeView({
    id: settingsNavigationTreeViewId,
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
  });

  shell.trees.registerTreeView({
    id: settingsFooterTreeViewId,
    title: "Settings footer",
    area: "left",
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
  });
};

const registerPanelModeResourceOpener = (shell: ShellCore, setLeftPanelMode: (mode: LeftPanelMode) => void) => {
  shell.resources.registerOpener({
    id: "multi-left-panel.resourceOpener",
    priority: 1000,
    canOpen: (resource) =>
      ["project", "dashboard-view", "ticket", "workspace", "settings", "extension-review"].includes(resource.kind),
    open: (resource) => {
      setLeftPanelMode(resolveLeftPanelMode(resource));
      return shell.layout.openWidget(resolveWidgetId(resource), { resource, title: resource.label });
    },
  });
};

const createMultiLeftPanelExample = (setLeftPanelMode: (mode: LeftPanelMode) => void) => {
  const example = createConsumerShellExample();

  registerWorkspaceNavigation(example.shell);
  registerSettingsNavigation(example.shell);
  registerPanelModeResourceOpener(example.shell, setLeftPanelMode);

  return example;
};

const LeftPanelHeader = (props: { setup: LeftPanelSetup }) => {
  const { setup } = props;

  return (
    <HStack gap="xs" minW="0">
      <ShellIcon name={setup.icon} size={16} />
      <Text textStyle="label/S/medium" truncate>
        {setup.title}
      </Text>
    </HStack>
  );
};

export const MultiLeftPanelShellExample = () => {
  const [leftPanelMode, setLeftPanelMode] = useState<LeftPanelMode>("project");
  const [example] = useState(() => createMultiLeftPanelExample(setLeftPanelMode));
  const leftPanelSetup = leftPanelSetups[leftPanelMode];

  return (
    <ShellWorkbench
      shell={example.shell}
      commandPaletteMenuPath={commandPaletteMenuPath}
      initialSessionPanelMode="attached"
      leftTreeViewId={leftPanelSetup.treeViewId}
      leftFooterTreeViewId={leftPanelSetup.footerTreeViewId}
      leftHeader={<LeftPanelHeader setup={leftPanelSetup} />}
    />
  );
};
