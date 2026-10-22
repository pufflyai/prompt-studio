import { Box, Text } from "@chakra-ui/react";
import { WindowTitleBar } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
} satisfies Meta<typeof Workbench>;
export default meta;
type Story = StoryObj<typeof meta>;

export const HostTitle: Story = {
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const titleBar = canvasElement.querySelector("[data-window-title-bar]")!;
    const title = within(titleBar as HTMLElement);
    const maximize = canvas.getByRole("button", { name: "Enter Main fullscreen" });
    await expect(title.getByRole("button", { name: "Enter Main fullscreen" })).toBe(maximize);
    const controls = title.getByRole("group", { name: "Panel controls" });
    await expect(controls.getBoundingClientRect().right).toBeLessThanOrEqual(maximize.getBoundingClientRect().left);
    await expect(titleBar.getBoundingClientRect().right - maximize.getBoundingClientRect().right).toBeLessThanOrEqual(
      10,
    );
    await userEvent.click(canvas.getByRole("button", { name: "Hide Side Panel" }));
    await expect(canvas.getByRole("button", { name: "Show Side Panel" })).toBeVisible();
    await userEvent.click(maximize);
    await expect(titleBar).not.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Exit Main fullscreen" }));
    await expect(titleBar).toBeVisible();
    await waitFor(() => expect(maximize).toHaveFocus());
    await userEvent.click(maximize);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(maximize).toHaveFocus());
  },
};
