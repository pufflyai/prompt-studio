import type {
  ExtensionDiagnostic,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
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
    displayName: "Prompt Studio Planner",
    version: "0.4.2",
    description: "Plan and track tickets across workspaces.",
    sourcePath: "/repo/.pstdio/extensions/pstdio-planner",
    scope: "repo",
    status: "loaded",
    lastLoadedAt: "2026-08-04T09:14:00.000Z",
    enabled: true,
    config: {},
    canUpgrade: true,
    updateAvailable: false,
  },
  {
    id: "issue-tracker-instance",
    projectId: "project-1",
    extensionId: "acme.issue-tracker",
    installedExtensionId: "installed-issue-tracker",
    installName: "issue-tracker",
    name: "issue-tracker",
    displayName: "Acme Issue Tracker",
    version: "1.0.0",
    description: "Issue data and command surface.",
    sourcePath: "/home/user/.pstdio/extensions/issue-tracker",
    scope: "global",
    status: "error",
    lastLoadedAt: "2026-08-04T08:02:00.000Z",
    lastError: {
      code: "extension_import_failed",
      message: "Cannot find module './features/loops/index.js' — imported from extension.js.",
    },
    enabled: true,
    config: {},
    canUpgrade: false,
    updateAvailable: false,
  },
  {
    id: "lab-instance",
    projectId: "project-1",
    extensionId: "extension.lab",
    installedExtensionId: "installed-lab",
    installName: "extension-lab",
    name: "extension-lab",
    displayName: "Extension Lab",
    version: "0.1.0",
    description: "Demo and experimental commands.",
    sourcePath: "/home/user/.pstdio/extensions/extension-lab",
    scope: "global",
    status: "disabled",
    enabled: false,
    config: {},
    canUpgrade: true,
    updateAvailable: false,
  },
];

const automations: WorkbenchExtensionAutomationRecord[] = [
  {
    id: "pstdio-planner.refine-tickets",
    localId: "refine-tickets",
    extensionId: "pstdio.planner",
    extensionInstanceId: "planner-instance",
    title: "Refine open tickets",
    cron: "0 6 * * *",
    commandId: "pstdio-planner.refine",
    enabled: true,
  },
  {
    id: "pstdio-planner.stuck-work-sweep",
    localId: "stuck-work-sweep",
    extensionId: "pstdio.planner",
    extensionInstanceId: "planner-instance",
    title: "Sweep stuck work",
    cron: "*/30 * * * *",
    commandId: "pstdio-planner.sweep",
    enabled: false,
  },
];

const diagnostics: ExtensionDiagnostic[] = [
  {
    code: "stale-template",
    severity: "warning",
    message: "Bundled template is older than the installed copy.",
    extensionId: "pstdio.planner",
    sourcePath: "templates/ticket.md",
  },
];

const marketplace = [
  {
    installName: "pstdio-reports",
    displayName: "Prompt Studio Reports",
    description: "Workspace reports for agent handoffs.",
    installed: false,
    origin: {
      kind: "git" as const,
      url: "https://github.com/pufflyai/prompt-studio",
      path: "extensions/pstdio-reports",
      ref: "pstdio@0.28.0",
    },
    publisher: "pufflyai",
  },
  {
    installName: "pstdio-planner",
    displayName: "Prompt Studio Planner",
    description: "Tickets, managed attempts, reviews, and templates.",
    installed: false,
    origin: {
      kind: "git" as const,
      url: "https://github.com/pufflyai/prompt-studio",
      path: "extensions/pstdio-planner",
      ref: "pstdio@0.28.0",
    },
    publisher: "pufflyai",
  },
];

const meta: Meta<typeof ExtensionsPanelView> = {
  title: "ProjectSettings/ExtensionsPanel",
  component: ExtensionsPanelView,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj<typeof ExtensionsPanelView>;

export const Populated: Story = {
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics,
    automations,
  },
};

export const Empty: Story = {
  args: {
    extensions: [],
    marketplace,
    diagnostics: [],
    automations: [],
  },
};

export const Mutating: Story = {
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics: [],
    automations,
    togglingInstanceId: "planner-instance",
  },
};

export const InstallingMultipleAvailableExtensions: Story = {
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics: [],
    automations,
    installingMarketplaceNames: ["pstdio-reports", "pstdio-planner"],
  },
};

export const HealthPopoverOpen: Story = {
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics,
    automations,
  },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('[data-testid="extension-health-trigger"]')?.click();
  },
};
