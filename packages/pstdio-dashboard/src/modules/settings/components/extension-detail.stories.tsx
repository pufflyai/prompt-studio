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
  panels: [],
  routes: [],
  navigation: [],
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
    onChangeSetting: noop,
    onRetry: noop,
    onAttemptFix: noop,
    onUninstall: noop,
  },
};

export default meta;

type Story = StoryObj<typeof ExtensionDetail>;

export const Loaded: Story = {};

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
