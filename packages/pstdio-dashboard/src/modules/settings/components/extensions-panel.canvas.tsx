import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type {
  ExtensionDiagnostic,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import type { AgentInfo } from "pstdio-api-contracts";
import { ExtensionsPanelView } from "./extensions-panel-view";

const installedExtensions: ProjectExtensionInstance[] = [
  {
    id: "planner-instance",
    projectId: "project-1",
    extensionId: "pstdio.planner",
    installedExtensionId: "installed-planner",
    installName: "pstdio-planner",
    name: "pstdio-planner",
    displayName: "Project Planner",
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
    displayName: "Project Planner",
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
const noop = () => {};
const failedExtension = installedExtensions[1]!;
const meta: CanvasMeta<typeof ExtensionsPanelView> = {
  title: "ProjectSettings/ExtensionsPanel",
  component: ExtensionsPanelView,
  fullscreen: true,
  args: { onUpgrade: noop, onDropFolder: noop },
};
export default meta;
type Story = CanvasVariant<typeof ExtensionsPanelView>;
export const Populated: Story = {
  id: "projectsettings-extensionspanel--populated",
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics,
    automations,
  },
};
const remote = {
  ...installedExtensions[0]!,
  extensionId: "example.remote",
  displayName: "Remote helper",
  canUpgrade: false,
};
const remoteAgent: AgentInfo = {
  id: "arbitrary-remote-provider-id",
  name: "Remote helper",
  supportsModels: false,
  capabilities: [],
  availability: { type: "NOT_FOUND", reason: "Connect a machine in this extension's settings." },
};
export const HarnessUnavailable: Story = {
  id: "projectsettings-extensionspanel--harness-unavailable",
  args: {
    extensions: [remote],
    marketplace: [],
    diagnostics: [],
    automations: [],
    harnesses: [{ id: remoteAgent.id, localId: "helper", extensionId: remote.extensionId }],
    agents: [remoteAgent],
  },
};
export const HarnessCheckUnknown: Story = {
  id: "projectsettings-extensionspanel--harness-check-unknown",
  args: { ...HarnessUnavailable.args, agents: undefined },
};
export const HarnessAndExtensionIssues: Story = {
  id: "projectsettings-extensionspanel--harness-and-extension-issues",
  args: {
    ...HarnessUnavailable.args,
    diagnostics: [{ ...diagnostics[0]!, extensionId: remote.extensionId }],
  },
};
export const LongHarnessReason: Story = {
  id: "projectsettings-extensionspanel--long-harness-reason",
  args: {
    ...HarnessUnavailable.args,
    agents: [{ ...remoteAgent, availability: { type: "NOT_FOUND", reason: `RemoteEndpoint/${"a".repeat(280)}` } }],
  },
};
export const HarnessDisabled: Story = {
  id: "projectsettings-extensionspanel--harness-disabled",
  args: { ...HarnessUnavailable.args, extensions: [{ ...remote, enabled: false, status: "disabled" }] },
};
export const Empty: Story = {
  id: "projectsettings-extensionspanel--empty",
  args: {
    extensions: [],
    marketplace,
    diagnostics: [],
    automations: [],
  },
};
export const Mutating: Story = {
  id: "projectsettings-extensionspanel--mutating",
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics: [],
    automations,
    togglingInstanceId: "planner-instance",
  },
};
export const InstallingMultipleAvailableExtensions: Story = {
  id: "projectsettings-extensionspanel--installing-multiple-available-extensions",
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics: [],
    automations,
    installingMarketplaceNames: ["pstdio-reports", "pstdio-planner"],
  },
};
export const HealthPopoverOpen: Story = {
  id: "projectsettings-extensionspanel--health-popover-open",
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics,
    automations,
  },
};
// A catalog extension that fails to load can take a newer release, so the popover offers Upgrade.
export const FailedCatalogExtension: Story = {
  id: "projectsettings-extensionspanel--failed-catalog-extension",
  args: {
    extensions: [{ ...failedExtension, canUpgrade: true }],
    marketplace,
    diagnostics: [],
    automations: [],
  },
};
// A local source is fixed where it lives, so the popover offers Copy error only.
export const FailedLocalExtension: Story = {
  id: "projectsettings-extensionspanel--failed-local-extension",
  args: {
    extensions: [
      {
        ...failedExtension,
        scope: "repo",
        sourcePath: "/repo/.pstdio/extensions/issue-tracker",
        canUpgrade: false,
      },
    ],
    marketplace,
    diagnostics: [],
    automations: [],
  },
};
// Each row that can take a newer release shows an upgrade button, and the header offers one action
// for all of them.
export const UpgradesAvailable: Story = {
  id: "projectsettings-extensionspanel--upgrades-available",
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics: [],
    automations,
    onUpgradeAll: noop,
  },
};
export const UpgradingOneExtension: Story = {
  id: "projectsettings-extensionspanel--upgrading-one-extension",
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics: [],
    automations,
    upgradingInstanceIds: ["planner-instance"],
  },
};
// Upgrade all marks every row it will upgrade, so rows still waiting their turn show a spinner too.
export const UpgradingAll: Story = {
  id: "projectsettings-extensionspanel--upgrading-all",
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics: [],
    automations,
    upgradingAll: true,
    upgradingInstanceIds: installedExtensions
      .filter((extension) => extension.canUpgrade)
      .map((extension) => extension.id),
  },
};
// No row can take a newer release, so there are no row upgrade buttons and no Upgrade all.
export const NothingToUpgrade: Story = {
  id: "projectsettings-extensionspanel--nothing-to-upgrade",
  args: {
    extensions: installedExtensions.map((extension) => ({ ...extension, canUpgrade: false })),
    marketplace,
    diagnostics: [],
    automations,
  },
};
export const AddingLocalFolder: Story = {
  id: "projectsettings-extensionspanel--adding-local-folder",
  args: {
    extensions: installedExtensions,
    marketplace,
    diagnostics: [],
    automations,
    addingFolderName: "my-extension",
  },
};
