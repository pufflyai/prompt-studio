import { ParamEditor } from "@pstdio/ui/param-editor";
import type { Meta, StoryObj } from "@storybook/react";
import { DEFAULT_STATUSES } from "../data/seed";
import { emptyWorkflowStatuses } from "../data/workflow-statuses";
import { workflowSettingsControls } from "./workflow-settings";

const controls = workflowSettingsControls({
  selections: {
    ...emptyWorkflowStatuses(),
    completedStatusIds: ["shipped"],
    blockedStatusIds: ["waiting"],
    activeStatusIds: ["building"],
    mergeTargetStatusId: "shipped",
  },
  statuses: [
    { ...DEFAULT_STATUSES[5]!, id: "shipped", name: "Delivered", sortOrder: 2, icon: "status-done", color: "green" },
    {
      ...DEFAULT_STATUSES[3]!,
      id: "waiting",
      name: "Needs a decision",
      sortOrder: 1,
      icon: "status-canceled",
      color: "orange",
    },
    { ...DEFAULT_STATUSES[2]!, id: "building", name: "Building", sortOrder: 0, icon: "status-progress", color: "blue" },
  ],
  missingStatusIds: [],
});
const meta: Meta<typeof ParamEditor> = {
  title: "Extensions/Planner/Workflow settings",
  component: ParamEditor,
  args: { variant: "small", groups: controls.groups, defaultValues: controls.values },
};
export default meta;
type Story = StoryObj<typeof ParamEditor>;
export const CurrentStatuses: Story = {};
export const EmptyChoices: Story = {
  args: {
    groups: workflowSettingsControls({ selections: emptyWorkflowStatuses(), statuses: [], missingStatusIds: [] })
      .groups,
    defaultValues: {},
  },
};
