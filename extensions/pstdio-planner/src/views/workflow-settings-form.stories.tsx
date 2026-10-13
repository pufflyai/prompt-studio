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
      { id: "shipped", name: "Delivered", sortOrder: 2, icon: "status-done", color: "green" },
      { id: "waiting", name: "Needs a decision", sortOrder: 1, icon: "status-canceled", color: "orange" },
      { id: "building", name: "Building", sortOrder: 0, icon: "status-progress", color: "blue" },
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
      { id: "shipped", name: "Shipped", sortOrder: 2, icon: "status-done", color: "green" },
      { id: "waiting", name: "Paused", sortOrder: 1, icon: "status-canceled", color: "orange" },
      { id: "building", name: "Underway", sortOrder: 0, icon: "status-progress", color: "blue" },
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
