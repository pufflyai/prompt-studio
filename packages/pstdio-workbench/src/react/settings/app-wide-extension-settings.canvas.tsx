import { Box, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { workbenchSlots } from "@pstdio/sdk/extensions";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { registerWorkbenchExtensionContributions } from "../../extensions/host/workbench-extension-host";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "../workbench/workbench";
import { createWorkbenchSettingsModule, WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "./settings-module";

const metadata: WorkbenchExtensionMetadata = {
  extensions: [
    { id: "example.device-tools", name: "device-tools", displayName: "Device Tools", sourcePath: "/device-tools" },
  ],
  views: [
    {
      id: "example.device-tools.view.settings",
      localId: "settings",
      extensionId: "example.device-tools",
      title: "Device Tools",
      body: {
        kind: "webview",
        webview: {
          entry: { kind: "package-asset", path: "./settings.tsx", baseUrl: "file:///device-tools/" },
          runtimeUrl: "/runtime.html",
          moduleUrl: "/settings.js",
        },
      },
    },
  ],
  settingsPanels: [
    {
      id: "example.device-tools.settings-panel.settings",
      extensionId: "example.device-tools",
      view: { extensionId: "example.device-tools", kind: "view", id: "settings" },
      slot: workbenchSlots.globalSettings,
    },
  ],
  commands: [],
  menuContributions: [],
  commandPaletteContributions: [],
  modes: [],
  pages: [],
  placements: [],
  resourceKinds: [],
  navigationItems: [],
  navigationTrees: [],
  statusBarItems: [],
  viewMenus: [],
  diagnostics: [],
};

const AppWideSettings = (props: { projectId: string }) => {
  const { projectId } = props;
  const [workbench] = useState(() => createWorkbench());
  useEffect(() => {
    const settings = workbench.registerModule(createWorkbenchSettingsModule());
    const extension = registerWorkbenchExtensionContributions({
      workbench,
      metadata,
      projectId,
      executeCommand: () => undefined,
      renderWebview: () => (
        <Stack p="lg" gap="sm">
          <Text textStyle="heading/M/semibold">Device Tools</Text>
          <Text textStyle="paragraph/S/regular">These settings apply in every project on this device.</Text>
        </Stack>
      ),
    });
    void workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID);
    return () => {
      extension.dispose();
      settings.dispose();
    };
  }, [workbench, projectId]);
  return <Workbench workbench={workbench} />;
};

const meta = {
  title: "pstdio-workbench/Reference/Core API/App-wide extension settings",
  component: AppWideSettings,
  args: { projectId: "first-project" },
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box h="100vh">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AppWideSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FirstProject: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole("option", { name: "Device Tools" })).toBeVisible();
  },
};
export const SecondProject: Story = { ...FirstProject, args: { projectId: "second-project" } };
