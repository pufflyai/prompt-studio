import { Box, Text } from "@chakra-ui/react";
import { WindowTitleBar } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "./workbench";

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
