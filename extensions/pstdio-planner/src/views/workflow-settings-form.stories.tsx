import type { Meta, StoryObj } from "@storybook/react";
import { WorkflowSettingsForm } from "./workflow-settings-form";

const selections = {
  completedStatusIds: ["shipped"],
  blockedStatusIds: ["waiting"],
  activeStatusIds: ["building"],
  mergeTargetStatusId: "shipped",
};
const meta: Meta<typeof WorkflowSettingsForm> = {
  title: "Extensions/Planner/Workflow settings",
  component: WorkflowSettingsForm,
  args: {
    selections,
    statuses: [
      { id: "shipped", name: "Delivered", sortOrder: 2 },
      { id: "waiting", name: "Needs a decision", sortOrder: 1 },
      { id: "building", name: "Building", sortOrder: 0 },
    ],
    onSave: async () => {},
  },
};
export default meta;
type Story = StoryObj<typeof WorkflowSettingsForm>;
export const CustomStatuses: Story = {};
export const EmptyChoices: Story = {
  args: {
    selections: { completedStatusIds: [], blockedStatusIds: [], activeStatusIds: [], mergeTargetStatusId: null },
  },
};
export const Renamed: Story = {
  args: {
    statuses: [
      { id: "shipped", name: "Shipped", sortOrder: 2 },
      { id: "waiting", name: "Paused", sortOrder: 1 },
      { id: "building", name: "Underway", sortOrder: 0 },
    ],
  },
};
export const MissingChoice: Story = { args: { statuses: [] } };
export const SaveFailure: Story = {
  args: {
    onSave: async () => {
      throw new Error("Unable to save. Your choices are preserved.");
    },
  },
};
