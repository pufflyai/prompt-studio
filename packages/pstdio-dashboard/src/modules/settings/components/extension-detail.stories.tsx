import type { ProjectExtensionInstance, WorkbenchExtensionAutomationRecord } from "@pstdio/sdk/api";
import type { Meta, StoryObj } from "@storybook/react";
import { ExtensionDetail } from "./extension-detail";

const extension: ProjectExtensionInstance = {
  id: "planner-instance",
  projectId: "project-1",
  extensionId: "pstdio.planner",
  installedExtensionId: "installed-planner",
  installName: "pstdio-planner",
  name: "pstdio-planner",
  displayName: "Prompt Studio Planner",
  version: "0.7.0",
  description: "Tickets, proposals and planning loops. Contributes the ticket board and planner views.",
  sourcePath: "/repo/.pstdio/extensions/pstdio-planner",
  scope: "repo",
  status: "loaded",
  lastLoadedAt: "2026-08-04T09:14:00.000Z",
  enabled: true,
  config: {},
  canUpgrade: false,
  updateAvailable: false,
};

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
    id: "pstdio-planner.implement-tickets",
    localId: "implement-tickets",
    extensionId: "pstdio.planner",
    extensionInstanceId: "planner-instance",
    title: "Implement Todo tickets",
    cron: "0 7 * * *",
    commandId: "pstdio-planner.implement",
    enabled: false,
  },
];

const noop = () => {};

const metadata = {
  extensions: [],
  commands: [
    {
      id: "planner.createTicket",
      extensionId: "pstdio.planner",
      title: "Create ticket",
      cliPath: "tickets create",
    },
    { id: "planner.refineTicket", extensionId: "pstdio.planner", title: "Refine ticket" },
  ],
  menuContributions: [
    {
      id: "planner.menu.create",
      extensionId: "pstdio.planner",
      commandId: "planner.createTicket",
      slotId: "workbench.top.actions",
      label: "Create ticket",
    },
  ],
  commandPaletteContributions: [],
  keybindings: [
    {
      id: "planner.kb.create",
      extensionId: "pstdio.planner",
      commandId: "planner.createTicket",
      key: "mod+shift+t",
      hotkey: "mod+shift+t",
    },
  ],
  modes: [],
  pages: [],
  views: [],
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  navigationItems: [],
  navigationTrees: [],
  statusBarItems: [],
  statuses: [],
  settingsPanels: [],
  diagnostics: [],
} as never;

const settings = [
  {
    key: "automation.enabled",
    extensionId: "pstdio.planner",
    type: "boolean",
    scope: "project",
    default: false,
    title: "Enable automations",
    description: "Allow scheduled planner loops to run in this project.",
    value: true,
    source: "stored",
  },
  {
    key: "board.defaultView",
    extensionId: "pstdio.planner",
    type: "string",
    scope: "project",
    enum: ["board", "list"],
    default: "board",
    title: "Default view",
    source: "default",
  },
] as never;

const meta: Meta<typeof ExtensionDetail> = {
  title: "ProjectSettings/ExtensionDetail",
  component: ExtensionDetail,
  parameters: { layout: "fullscreen" },
  args: {
    extension,
    metadata,
    automations,
    diagnostics: [],
    settings,
    onBack: noop,
    onToggle: noop,
    onToggleAutomation: noop,
    executeOptionCommand: async () => [],
    onChangeSetting: noop,
    onReload: noop,
    onUpgrade: noop,
    onUninstall: noop,
  },
};

export default meta;

type Story = StoryObj<typeof ExtensionDetail>;

export const Loaded: Story = {};

// A local source is fixed where it lives, so the alert offers only Copy error.
export const FailedToLoad: Story = {
  args: {
    extension: {
      ...extension,
      status: "error",
      lastError: {
        code: "extension_import_failed",
        message: "Cannot find module './features/loops/index.js' — imported from extension.js.",
      },
    },
  },
};

export const Disabled: Story = {
  args: {
    extension: { ...extension, enabled: false, status: "disabled" },
  },
};

// A second copy of an extension a project already runs stays off until someone picks it, so the
// source folder is the only thing that tells the two apart.
export const ConflictingSourceFolder: Story = {
  args: {
    extension: {
      ...extension,
      enabled: false,
      status: "disabled",
      sourcePath: "/Users/dev/work/second-checkout/.pstdio/extensions/pstdio-planner",
    },
  },
};

// A local source folder changed. Reloading adopts it; nothing is fetched from a release.
export const LocalChangesWaiting: Story = {
  args: {
    extension: { ...extension, updateAvailable: true },
  },
};

export const UpgradeAvailable: Story = {
  args: {
    extension: {
      ...extension,
      canUpgrade: true,
      scope: "global",
      sourcePath: "/home/user/.pstdio/extensions/pstdio-planner",
    },
  },
};

// A catalog extension can take a newer release, so the alert also offers Upgrade.
export const FailedCatalogExtension: Story = {
  args: {
    extension: {
      ...extension,
      canUpgrade: true,
      scope: "global",
      sourcePath: "/home/user/.pstdio/extensions/pstdio-planner",
      status: "error",
      lastError: {
        code: "extension_import_failed",
        message: "Cannot find module './features/loops/index.js' — imported from extension.js.",
      },
    },
  },
};

export const IncompatibleApi: Story = {
  args: {
    extension: {
      ...extension,
      canUpgrade: true,
      scope: "global",
      sourcePath: "/home/user/.pstdio/extensions/pstdio-planner",
      status: "error",
      lastError: {
        code: "extension_manifest_unsupported_api_version",
        message:
          'Extension "pstdio-planner" targets extension API ^0.0.9 but this host provides 0.1.0. Upgrade the extension to its build for this host.',
      },
    },
  },
};

// A local source is fixed where it lives, so the alert offers Copy error but no Upgrade.
export const IncompatibleLocalSource: Story = {
  args: {
    extension: {
      ...extension,
      displayName: "Font Editor",
      extensionId: "pstdio.font-editor",
      installName: "font-editor",
      name: "font-editor",
      sourcePath: "/repo/.pstdio/extensions/font-editor",
      status: "error",
      lastError: {
        code: "extension_manifest_unsupported_api_version",
        message:
          'Extension "font-editor" targets extension API ^0.0.9 but this host provides 0.1.0. Fix the extension source: make it work with extension API 0.1.0, then add "^0.1.0" to engines.pstdio in its package.json.',
      },
    },
  },
};
