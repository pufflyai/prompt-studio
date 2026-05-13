import { Button, HStack, Text } from "@chakra-ui/react";
import { useLayoutEffect, useState } from "react";
import type { ResourceRef, ShellCore, ShellModeActivationContext } from "../core";
import { ShellIcon, ShellWorkbench } from "../react";
import { createConsumerShellExample } from "./consumer-shell-example";
import { shellExampleResources, shellWidgetIds } from "./consumer-shell-example-data";

type LeftPanelMode = "project" | "workspace" | "settings";

interface LeftPanelSetup {
  title: string;
  icon: string;
}

const leftPanelSetups = {
  project: { title: "Prompt Studio", icon: "FolderGit2" },
  workspace: { title: "Workspace", icon: "GitBranch" },
  settings: { title: "Project settings", icon: "Settings" },
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

const modePriority = { priority: 1000 };

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

const registerPanelModeResourceOpener = (shell: ShellCore) => {
  shell.resources.registerOpener({
    id: "workbench-modes.resourceOpener",
    priority: 1000,
    canOpen: (resource) =>
      ["project", "dashboard-view", "ticket", "workspace", "settings", "extension-review"].includes(resource.kind),
    open: (resource) => {
      shell.modes.setActiveMode(resolveLeftPanelMode(resource));
      return shell.layout.openWidget(resolveWidgetId(resource), { resource, title: resource.label });
    },
  });
};

const LEFT_HEADER_WIDGET_ID = "workbench-modes.leftHeader";

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

const createWorkbenchModesExample = () => {
  const example = createConsumerShellExample();

  registerWorkbenchModes(example.shell);
  registerLeftHeader(example.shell);
  registerPanelModeResourceOpener(example.shell);
  example.shell.modes.setActiveMode("project");

  return example;
};

const LeftPanelHeader = (props: { shell: ShellCore }) => {
  const { shell } = props;
  const [activeMode, setActiveMode] = useState<LeftPanelMode>(
    (shell.modes.getActiveModeId() as LeftPanelMode | undefined) ?? "project",
  );

  useLayoutEffect(() => {
    return shell.modes.onDidChangeActive(() => {
      const next = shell.modes.getActiveModeId() as LeftPanelMode | undefined;
      if (next) setActiveMode(next);
    }).dispose;
  }, [shell]);

  const setup = leftPanelSetups[activeMode];

  return (
    <HStack gap="xs" minW="0" justifyContent="space-between" w="full">
      <HStack gap="xs" minW="0">
        <ShellIcon name={setup.icon} size={16} />
        <Text textStyle="label/S/medium" truncate>
          {setup.title}
        </Text>
      </HStack>
      <HStack gap="2xs">
        {(Object.keys(leftPanelSetups) as LeftPanelMode[]).map((mode) => (
          <Button
            key={mode}
            size="2xs"
            variant={mode === activeMode ? "subtle" : "ghost"}
            onClick={() => shell.modes.setActiveMode(mode)}
          >
            {leftPanelSetups[mode].title}
          </Button>
        ))}
      </HStack>
    </HStack>
  );
};

export const WorkbenchModesShellExample = () => {
  const [example] = useState(createWorkbenchModesExample);

  return <ShellWorkbench shell={example.shell} initialSessionPanelMode="attached" />;
};
