import { Box, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { workbenchSlots } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";
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
} satisfies CanvasMeta<typeof AppWideSettings>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const FirstProject: Story = {
  id: "pstdio-workbench-reference-core-api-app-wide-extension-settings--first-project",
};
export const SecondProject: Story = {
  id: "pstdio-workbench-reference-core-api-app-wide-extension-settings--second-project",
  ...FirstProject,
  args: { projectId: "second-project" },
};
