import type { Meta, StoryObj } from "@storybook/react";
import { AutoBuildDialog } from "./auto-build-dialog";

const meta: Meta<typeof AutoBuildDialog> = {
  title: "Extensions/Planner/Auto Build",
  component: AutoBuildDialog,
  args: {
    saving: false,
    maxInProgress: 2,
    onEnable: async () => true,
    onClose: () => {},
    t: (_key, fallback) => fallback ?? _key,
  },
};
export default meta;
type Story = StoryObj<typeof AutoBuildDialog>;
export const ProjectWide: Story = {};
export const Saving: Story = { args: { saving: true } };
export const NoCapacity: Story = { args: { maxInProgress: 0 } };
export const Failure: Story = { args: { error: "Agent unavailable" } };
