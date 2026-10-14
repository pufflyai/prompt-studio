import { Box, IconButton, Text } from "@chakra-ui/react";
import { WindowTabs, WindowTitleBar } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { expect, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { createPanelControlsFixture } from "../../examples/windowing/panel-controls-fixture";
import { WorkbenchIcon } from "../shared/icon";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
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

const DesktopControls = () => {
  const [fixture] = useState(createPanelControlsFixture);
  useEffect(
    () => () => {
      void fixture.dispose();
    },
    [fixture],
  );
  return (
    <Workbench
      workbench={fixture.workbench}
      panelTogglesInHost
      titleBar={
        <WindowTitleBar platform="darwin">
          <WindowTabs
            aria-label="Project tabs"
            tabs={[{ id: "project", label: "Windowing project" }]}
            selectedId="project"
            onSelect={() => {}}
            onClose={() => {}}
          />
          <IconButton aria-label="Open / create project" size="xs" variant="ghost">
            <WorkbenchIcon name="Plus" />
          </IconButton>
          <WorkbenchPanelToggles workbench={fixture.workbench} />
        </WindowTitleBar>
      }
    />
  );
};
export const DesktopPanelControls: Story = {
  args: { workbench: createWorkbench() },
  render: () => <DesktopControls />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tab", { name: /Windowing project/ })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Show Navigation" })).toBeVisible();
    await expect(
      canvasElement.querySelector('[data-workbench-region="status"] [data-workbench-panel-toggles]'),
    ).toBeNull();
    await expect(canvas.getAllByRole("group", { name: "Panel toggles" })).toHaveLength(1);
  },
};
