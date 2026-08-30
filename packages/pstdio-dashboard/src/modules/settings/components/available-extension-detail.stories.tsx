import type { Meta, StoryObj } from "@storybook/react";
import { AvailableExtensionDetail } from "./available-extension-detail";

const noop = () => undefined;

const metadata = {
  extensions: [
    {
      id: "pstdio.pstdio-reports",
      name: "pstdio-reports",
      displayName: "Prompt Studio Reports",
      sourcePath: "",
    },
  ],
  commands: [
    {
      id: "pstdio-reports.write",
      extensionId: "pstdio.pstdio-reports",
      title: "Write report",
      cliPath: "reports write",
    },
  ],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [],
  pages: [],
  views: [],
  viewMenus: [],
  placements: [],
  resourceKinds: [],
  resourceViews: [],
  navigationItems: [],
  statusBarItems: [],
  statuses: [],
  settingsPanels: [],
  skills: [
    {
      id: "pstdio-reports.use-reports",
      localId: "use-reports",
      extensionId: "pstdio.pstdio-reports",
      title: "Use reports",
    },
  ],
  templates: [
    {
      id: "pstdio-reports.change-request",
      localId: "change-request",
      extensionId: "pstdio.pstdio-reports",
      title: "Change request",
    },
  ],
  templateTypes: [
    {
      id: "pstdio.pstdio-reports.template-type.report",
      localId: "report",
      extensionId: "pstdio.pstdio-reports",
      label: "Report",
      order: 40,
      commands: {
        list: "pstdio.pstdio-reports.command.templates.list",
        read: "pstdio.pstdio-reports.command.templates.read",
        save: "pstdio.pstdio-reports.command.templates.save",
        delete: "pstdio.pstdio-reports.command.templates.delete",
      },
    },
  ],
  diagnostics: [],
} as never;

const meta: Meta<typeof AvailableExtensionDetail> = {
  title: "ProjectSettings/AvailableExtensionDetail",
  component: AvailableExtensionDetail,
  parameters: { layout: "fullscreen" },
  args: {
    extension: {
      installName: "pstdio-reports",
      displayName: "Prompt Studio Reports",
      description: "Workspace reports for agent handoffs.",
      installed: false,
      origin: {
        kind: "git",
        url: "https://github.com/pufflyai/prompt-studio",
        path: "extensions/pstdio-reports",
        ref: "pstdio@0.28.0",
      },
      publisher: "pufflyai",
    },
    metadata,
    loadingContributions: false,
    installing: false,
    onBack: noop,
    onInstall: noop,
  },
};

export default meta;

type Story = StoryObj<typeof AvailableExtensionDetail>;

export const Contributions: Story = {};

export const Installing: Story = {
  args: { installing: true },
};
