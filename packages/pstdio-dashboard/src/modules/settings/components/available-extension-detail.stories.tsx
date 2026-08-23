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
  modes: [],
  panels: [],
  routes: [],
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
