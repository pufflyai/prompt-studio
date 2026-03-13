import type { Meta, StoryObj } from "@storybook/react";
import { WorkspaceActionControl } from "./workspace-action-control";

const meta = {
  title: "Workspaces/WorkspaceActionControl",
  component: WorkspaceActionControl,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof WorkspaceActionControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  args: {
    canMerge: true,
    isSwapped: false,
    onMerge: () => {},
    onSwitchTo: () => {},
    onSwitchBack: () => {},
  },
};

export const Disabled: Story = {
  args: {
    canMerge: false,
    isSwapped: false,
    onMerge: () => {},
    onSwitchTo: () => {},
    onSwitchBack: () => {},
  },
};

export const Swapped: Story = {
  args: {
    canMerge: true,
    isSwapped: true,
    onMerge: () => {},
    onSwitchTo: () => {},
    onSwitchBack: () => {},
  },
};
