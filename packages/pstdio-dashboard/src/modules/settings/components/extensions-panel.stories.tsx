import type { ExtensionDiagnostic, ProjectExtensionInstance } from "@pstdio/sdk/api";
import type { Meta, StoryObj } from "@storybook/react";
import { ExtensionsPanelView } from "./extensions-panel";

const installedExtensions: ProjectExtensionInstance[] = [
  {
    id: "planner-instance",
    projectId: "project-1",
    extensionId: "pstdio.planner",
    installedExtensionId: "installed-planner",
    installName: "pstdio-planner",
    name: "pstdio-planner",
    displayName: "pstdio-planner",
    version: "0.4.2",
    description: "Plan and track tickets across workspaces.",
    sourcePath: "extensions/pstdio-planner",
    enabled: true,
    config: {},
  },
  {
    id: "core-tickets-instance",
    projectId: "project-1",
    extensionId: "pstdio.core-tickets",
    installedExtensionId: "installed-core-tickets",
    installName: "pstdio-core-tickets",
    name: "pstdio-core-tickets",
    displayName: "pstdio-core-tickets",
    version: "1.0.0",
    description: "Ticket data and command surface.",
    sourcePath: "extensions/pstdio-core-tickets",
    enabled: true,
    config: {},
  },
  {
    id: "lab-instance",
    projectId: "project-1",
    extensionId: "extension.lab",
    installedExtensionId: "installed-lab",
    installName: "extension-lab",
    name: "extension-lab",
    displayName: "extension-lab",
    version: "0.1.0",
    description: "Demo and experimental commands.",
    sourcePath: "extensions/extension-lab",
    enabled: false,
    config: {},
  },
];

const diagnostics: ExtensionDiagnostic[] = [
  {
    code: "missing-command",
    severity: "error",
    message: "Command contribution references a command that is not registered.",
    extensionId: "pstdio.planner",
    commandId: "tickets.refine",
    sourcePath: "commands/refine-ticket.ts",
  },
  {
    code: "stale-template",
    severity: "warning",
    message: "Bundled template is older than the installed copy.",
    extensionId: "pstdio.planner",
    sourcePath: "templates/ticket.md",
  },
  {
    code: "optional-menu-target",
    severity: "info",
    message: "Optional menu contribution is hidden until a workspace is selected.",
    extensionId: "pstdio.planner",
    commandId: "tickets.show-context",
  },
  {
    code: "slow-query",
    severity: "warning",
    message: "Slow query over large projects.",
    extensionId: "pstdio.core-tickets",
    commandId: "query-tickets",
    sourcePath: "commands/query-tickets.ts",
  },
  {
    code: "project-only",
    severity: "info",
    message: "Project-level diagnostic without a matching installed extension.",
    sourcePath: "extensions/project.ts",
  },
];

const meta: Meta<typeof ExtensionsPanelView> = {
  title: "ProjectSettings/ExtensionsPanel",
  component: ExtensionsPanelView,
  parameters: { layout: "padded" },
};

export default meta;

type Story = StoryObj<typeof ExtensionsPanelView>;

export const Populated: Story = {
  args: {
    extensions: installedExtensions,
    diagnostics: [],
  },
};

export const Empty: Story = {
  args: {
    extensions: [],
    diagnostics: [],
  },
};

export const Mutating: Story = {
  args: {
    extensions: installedExtensions,
    diagnostics: [],
    togglingInstanceId: "planner-instance",
    uninstallingInstanceId: "core-tickets-instance",
  },
};

export const CardDiagnosticsCollapsed: Story = {
  args: {
    extensions: installedExtensions,
    diagnostics,
  },
};

export const CardDiagnosticsExpanded: Story = {
  args: {
    extensions: installedExtensions,
    diagnostics,
  },
  play: async ({ canvasElement }) => {
    canvasElement
      .querySelectorAll<HTMLButtonElement>('[data-testid="extension-diagnostics-trigger"]')
      .forEach((trigger) => {
        trigger.click();
      });
  },
};
