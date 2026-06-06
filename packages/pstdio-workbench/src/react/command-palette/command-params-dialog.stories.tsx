import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { RegisteredCommand } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { CommandParamsDialog } from "./command-params-dialog";

const bumpCounterCommand = {
  command: {
    id: "extension-lab.counter.bump",
    label: "Bump lab counter",
    params: {
      amount: {
        type: "number",
        label: "Amount",
        defaultValue: 1,
      },
    },
  },
  handler: { execute: () => undefined },
  ownerId: "storybook",
  priority: 0,
  source: "module",
} satisfies RegisteredCommand;

const meta = {
  title: "pstdio-workbench/CommandParamsDialog",
  component: CommandParamsDialog,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box minH="100dvh">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
} satisfies Meta<typeof CommandParamsDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NumberParameter: Story = {
  args: {
    request: {
      label: "Bump lab counter",
      record: bumpCounterCommand,
    },
    onClose: () => {},
    onRun: async () => {},
  },
};
