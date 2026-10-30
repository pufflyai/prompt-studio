import { Box, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { WindowTitleBar } from "@pstdio/ui";
import { createWorkbench } from "../../core";
import { createPolicyWorkbench } from "../region/panel-policy.fixture";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { FullscreenControls } from "./fullscreen-controls";
import { Workbench } from "./workbench";
import { WorkbenchPanelToggles } from "./workbench-panel-toggles";

const meta = {
  title: "pstdio-workbench/Reference/Core API/Title bar",
  component: Workbench,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The host can place title-bar content above every workbench region. The slot shares the active workbench theme and remains visible across modes.",
      },
    },
  },
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box height="100vh">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies CanvasMeta<typeof Workbench>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const HostTitle: Story = {
  id: "pstdio-workbench-reference-core-api-title-bar--host-title",
  args: {
    workbench: createWorkbench(),
    titleBar: (
      <WindowTitleBar platform="darwin">
        <Text textStyle="label/S/medium">Prompt Studio</Text>
      </WindowTitleBar>
    ),
  },
};
export const HostPanelControls: Story = {
  id: "pstdio-workbench-reference-core-api-title-bar--host-panel-controls",
  args: (() => {
    const workbench = createPolicyWorkbench();
    return {
      workbench,
      panelControlsPlacement: "host" as const,
      titleBar: (
        <WindowTitleBar
          platform="darwin"
          actions={
            <>
              <WorkbenchPanelToggles workbench={workbench} />
              <FullscreenControls workbench={workbench} />
            </>
          }
        >
          <Text textStyle="label/S/medium">Project tabs</Text>
        </WindowTitleBar>
      ),
    };
  })(),
};
